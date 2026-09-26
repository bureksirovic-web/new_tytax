/** JSON backup round-trip: exportBackupJson -> fresh DB -> restoreBackupJson. */
import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import type { Repository } from '@/contracts';
import { draft, exercise, fakeSync, freshRepo, template } from '@/lib/db/__tests__/helpers';
import { exportBackupJson, isImportError, restoreBackupJson } from '..';
import { snapshot } from '../service/__fixtures__/testing';

const DAY = 86_400_000;

/** A profile with every record type, a duplicate exercise, PRs and soft-deleted rows; plus a second profile. */
async function seedRich() {
  const t = freshRepo();
  const { repo } = t;
  const p = await repo.profiles.create({ name: 'Rich', settings: { units: 'lb', theme: 'oled' }, avatarColor: '#4a7c3f' });
  const other = await repo.profiles.create({ name: 'Other' });
  const program = await repo.programs.create(p.id, template(3), { activate: true });
  const dropped = await repo.programs.create(p.id, template(2));
  await repo.programs.softDelete(p.id, dropped.id);
  await repo.finishWorkout(
    draft('w1', p.id, [exercise('u1', 'bench', [{ kg: 60, reps: 8 }, { kg: 20, reps: 10, type: 'warmup' }]), exercise('u2', 'bench', [{ kg: 50, reps: 10 }])], {
      programId: program.id,
    }),
    { rpe: 8, notes: 'dup bench', bodyweightKg: 80 },
  );
  t.tick(DAY);
  await repo.finishWorkout(draft('w2', p.id, [exercise('u3', 'bench', [{ kg: 70, reps: 5 }])], { startedAt: t.now().toISOString() }));
  t.tick(DAY);
  await repo.finishWorkout(draft('w3', p.id, [exercise('u4', 'squat', [{ kg: 90, reps: 5 }])], { startedAt: t.now().toISOString() }));
  await repo.logs.softDelete(p.id, 'w3');
  await repo.bodyweight.add(p.id, { date: '2026-03-01', valueKg: 80.5 });
  const gone = await repo.bodyweight.add(p.id, { date: '2026-03-02', valueKg: 81 });
  await repo.bodyweight.softDelete(p.id, gone.id);
  await repo.notes.set(p.id, 'bench', 'elbows in');
  await repo.notes.set(p.id, 'squat', 'x');
  await repo.notes.set(p.id, 'squat', '');
  await repo.arsenal.add(p.id, 'bench');
  await repo.arsenal.add(p.id, 'squat');
  await repo.arsenal.remove(p.id, 'squat');
  await repo.equipment.save(p.id, { stationIds: ['SMITH'], kettlebellsKg: [16, 24] });
  await repo.bodyweight.add(other.id, { date: '2026-03-01', valueKg: 60 });
  return { ...t, profileId: p.id, otherId: other.id };
}

function counts(repo: Repository) {
  return snapshot(repo).then((s) => Object.fromEntries(Object.entries(s).filter(([, v]) => Array.isArray(v)).map(([k, v]) => [k, (v as unknown[]).length])));
}

describe('backup round-trip', () => {
  it('restores a rich profile into a fresh DB deep-equal to the original', async () => {
    const src = await seedRich();
    const original = await snapshot(src.repo, src.profileId);
    expect(original.workoutLogs.some((l) => l.deletedAt)).toBe(true);
    expect(original.programs.some((p) => p.deletedAt)).toBe(true);
    expect(original.exerciseNotes.some((n) => n.deletedAt)).toBe(true);
    expect(original.arsenal.some((a) => a.deletedAt)).toBe(true);
    expect(original.bodyweightEntries.some((b) => b.deletedAt)).toBe(true);
    expect(original.prRecords.length).toBeGreaterThan(0);
    expect(original.equipment).toHaveLength(1);
    const w1 = original.workoutLogs.find((l) => l.id === 'w1');
    expect(w1?.exercises.map((e) => e.exerciseId)).toEqual(['bench', 'bench']);

    const text = await exportBackupJson(src.repo, src.profileId);
    const dst = freshRepo();
    const total = Object.values(await counts(src.repo)).reduce((a, b) => a + b, 0) - 2; // minus the other profile and its bodyweight
    expect(await restoreBackupJson(dst.repo, text)).toEqual({ inserted: total, updated: 0, skipped: 0, warnings: [] });
    expect(await snapshot(dst.repo)).toEqual(original);
    expect(await dst.repo.profiles.getActiveId()).toBeNull();
  });

  it('restoring twice changes nothing', async () => {
    const src = await seedRich();
    const text = await exportBackupJson(src.repo);
    const dst = freshRepo();
    const first = await restoreBackupJson(dst.repo, text);
    const after = await snapshot(dst.repo);
    const second = await restoreBackupJson(dst.repo, text);
    expect(second).toEqual({ inserted: 0, updated: 0, skipped: first.inserted, warnings: [] });
    expect(await snapshot(dst.repo)).toEqual(after);
    expect(after).toEqual(await snapshot(src.repo));
  });

  it('export is byte-stable and pretty output parses to the same data', async () => {
    const src = await seedRich();
    const a = await exportBackupJson(src.repo);
    const b = await exportBackupJson(src.repo);
    expect(a).toBe(b);
    const pretty = await exportBackupJson(src.repo, undefined, { pretty: true });
    expect(pretty).toContain('\n  "arsenal"');
    expect(JSON.parse(pretty)).toEqual(JSON.parse(a));
  });

  it('queues sync ops only for rows actually written', async () => {
    const src = await seedRich();
    const text = await exportBackupJson(src.repo, src.profileId);
    const dst = freshRepo({ sync: fakeSync() });
    const r = await restoreBackupJson(dst.repo, text);
    expect(await dst.repo.outbox.count()).toBe(r.inserted);
    const again = await restoreBackupJson(dst.repo, text);
    expect(again).toMatchObject({ inserted: 0, updated: 0, skipped: r.inserted });
    expect(await dst.repo.outbox.count()).toBe(r.inserted);
  });

  it('rejects malformed files with ImportError and writes nothing', async () => {
    const dst = freshRepo();
    const before = await snapshot(dst.repo);
    const cases = ['not json', '{"format":"other"}', JSON.stringify({ format: 'tytax-backup', version: 3 })];
    for (const text of cases) {
      await expect(restoreBackupJson(dst.repo, text)).rejects.toSatisfy((e: unknown) => isImportError(e));
    }
    expect(await snapshot(dst.repo)).toEqual(before);
  });
});
