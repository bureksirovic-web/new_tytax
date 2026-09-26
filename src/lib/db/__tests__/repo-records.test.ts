import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import type { EquipmentInventory } from '@/contracts/domain';
import { exercise, draft, fakeSync, freshRepo, T0, expectCode } from './helpers';

describe('soft delete', () => {
  it('hides a deleted log unless includeDeleted, and restore brings it (and its PRs) back', async () => {
    const { repo, tick } = freshRepo();
    const p = await repo.profiles.create({ name: 'A' });
    await repo.finishWorkout(draft('w1', p.id, [exercise('u1', 'bench', [{ kg: 60, reps: 5 }])]));
    expect(await repo.prs.list(p.id)).toHaveLength(2);

    tick();
    await repo.logs.softDelete(p.id, 'w1');
    expect(await repo.logs.list(p.id)).toEqual([]);
    expect(await repo.logs.get(p.id, 'w1')).toBeUndefined();
    expect((await repo.logs.get(p.id, 'w1', { includeDeleted: true }))?.deletedAt).toBeDefined();
    expect(await repo.logs.count(p.id)).toBe(0);
    expect(await repo.logs.count(p.id, { includeDeleted: true })).toBe(1);
    expect(await repo.prs.list(p.id)).toEqual([]);

    tick();
    await repo.logs.restore(p.id, 'w1');
    const back = await repo.logs.get(p.id, 'w1');
    expect(back?.deletedAt).toBeUndefined();
    expect(await repo.logs.count(p.id)).toBe(1);
    expect(await repo.prs.list(p.id)).toHaveLength(2);
  });

  it('bodyweight entries: validation, date range and soft delete', async () => {
    const { repo } = freshRepo();
    const p = await repo.profiles.create({ name: 'A' });
    await expectCode(repo.bodyweight.add(p.id, { date: '2026-02-30', valueKg: 70 }), 'VALIDATION');
    await expectCode(repo.bodyweight.add(p.id, { date: '2026-03-01', valueKg: -1 }), 'VALIDATION');
    const e1 = await repo.bodyweight.add(p.id, { date: '2026-03-01', valueKg: 70 });
    await repo.bodyweight.add(p.id, { date: '2026-03-05', valueKg: 71 });
    expect((await repo.bodyweight.list(p.id)).map((e) => e.date)).toEqual(['2026-03-05', '2026-03-01']);
    expect((await repo.bodyweight.list(p.id, { from: '2026-03-02' })).map((e) => e.valueKg)).toEqual([71]);
    await repo.bodyweight.softDelete(p.id, e1.id);
    expect(await repo.bodyweight.list(p.id)).toHaveLength(1);
    expect(await repo.bodyweight.list(p.id, { includeDeleted: true })).toHaveLength(2);
    await expectCode(repo.bodyweight.update(p.id, e1.id, { valueKg: 69 }), 'NOT_FOUND');
  });
});

describe('notes, arsenal, equipment, prs.best', () => {
  it('notes: upsert, empty string soft-deletes, set again revives the same row', async () => {
    const { repo } = freshRepo();
    const p = await repo.profiles.create({ name: 'A' });
    const n1 = await repo.notes.set(p.id, 'bench', 'tuck elbows');
    expect((await repo.notes.get(p.id, 'bench'))?.content).toBe('tuck elbows');
    expect(await repo.notes.set(p.id, 'bench', '')).toBeUndefined();
    expect(await repo.notes.get(p.id, 'bench')).toBeUndefined();
    const n2 = await repo.notes.set(p.id, 'bench', 'pause at chest');
    expect(n2?.id).toBe(n1?.id);
    expect(await repo.notes.list(p.id)).toHaveLength(1);
  });

  it('arsenal: add is idempotent, remove soft-deletes, has reflects it', async () => {
    const { repo } = freshRepo();
    const p = await repo.profiles.create({ name: 'A' });
    const e1 = await repo.arsenal.add(p.id, 'squat');
    const e2 = await repo.arsenal.add(p.id, 'squat');
    expect(e2.id).toBe(e1.id);
    expect(await repo.arsenal.has(p.id, 'squat')).toBe(true);
    await repo.arsenal.remove(p.id, 'squat');
    expect(await repo.arsenal.has(p.id, 'squat')).toBe(false);
    expect(await repo.arsenal.list(p.id)).toEqual([]);
    await repo.arsenal.remove(p.id, 'squat');
    expect((await repo.arsenal.add(p.id, 'squat')).id).toBe(e1.id);
  });

  it('equipment: default when missing, save merges and copies arrays', async () => {
    const { repo } = freshRepo();
    const p = await repo.profiles.create({ name: 'A' });
    const empty = await repo.equipment.get(p.id);
    expect(empty).toMatchObject({ id: p.id, profileId: p.id, stationIds: [], kettlebellsKg: [] });
    const kbs = [16, 24];
    const saved = await repo.equipment.save(p.id, { kettlebellsKg: kbs, stationIds: ['SMITH'] });
    kbs.push(32);
    expect(saved.kettlebellsKg).toEqual([16, 24]);
    const merged = await repo.equipment.save(p.id, { attachmentIds: ['rope'] });
    expect(merged).toMatchObject({ stationIds: ['SMITH'], attachmentIds: ['rope'], kettlebellsKg: [16, 24] });
    await expectCode(repo.equipment.save(p.id, { kettlebellsKg: [-4] }), 'VALIDATION');
  });

  it('prs.best returns the max-value live record per PR type', async () => {
    const { repo, tick } = freshRepo();
    const p = await repo.profiles.create({ name: 'A' });
    await repo.finishWorkout(draft('w1', p.id, [exercise('u1', 'bench', [{ kg: 60, reps: 10 }])]));
    tick(86_400_000);
    await repo.finishWorkout(draft('w2', p.id, [exercise('u2', 'bench', [{ kg: 70, reps: 3 }])], { startedAt: new Date(T0.getTime() + 86_400_000).toISOString() }));
    const best = await repo.prs.best(p.id, 'bench');
    // weight: max(60, 70) = 70, set by w2
    expect(best.weight?.value).toBe(70);
    expect(best.weight?.workoutLogId).toBe('w2');
    // e1rm: w1 60×10 → 60·36/27 = 80; w2 70×3 → 70·36/34 = 74.12, not a PR → best stays 80 from w1
    expect(best.e1rm?.value).toBe(80);
    expect(best.e1rm?.workoutLogId).toBe('w1');
  });
});

describe('record repos: validation, paging, deleted rows', () => {
  it('bodyweight update changes only given fields; missing profile or row is NOT_FOUND', async () => {
    const { repo, tick, now } = freshRepo();
    const p = await repo.profiles.create({ name: 'A' });
    const e = await repo.bodyweight.add(p.id, { date: '2026-03-01', valueKg: 70 });
    tick();
    const moved = await repo.bodyweight.update(p.id, e.id, { date: '2026-03-03' });
    expect(moved).toMatchObject({ date: '2026-03-03', valueKg: 70, updatedAt: now().toISOString(), createdAt: e.createdAt });
    expect((await repo.bodyweight.update(p.id, e.id, { valueKg: 69.5 })).valueKg).toBe(69.5);
    await expectCode(repo.bodyweight.update(p.id, e.id, { date: 'x' }), 'VALIDATION');
    await expectCode(repo.bodyweight.update(p.id, e.id, { valueKg: 0 }), 'VALIDATION');
    await expectCode(repo.bodyweight.add('ghost', { date: '2026-03-01', valueKg: 70 }), 'NOT_FOUND');
    await expectCode(repo.bodyweight.softDelete(p.id, 'ghost'), 'NOT_FOUND');
    await expectCode(repo.bodyweight.list(p.id, { to: 'today' }), 'VALIDATION');
    await repo.bodyweight.softDelete(p.id, e.id);
    await repo.bodyweight.softDelete(p.id, e.id);
    expect((await repo.bodyweight.list(p.id, { includeDeleted: true, limit: 1 }))[0].deletedAt).toBeDefined();
  });

  it('notes: whitespace-only deletes, list hides deleted, validation on content and exerciseId', async () => {
    const sync = fakeSync();
    const { repo, tick } = freshRepo({ sync });
    const p = await repo.profiles.create({ name: 'A' });
    await repo.notes.set(p.id, 'bench', 'a');
    tick();
    await repo.notes.set(p.id, 'squat', 'b');
    expect((await repo.notes.list(p.id)).map((n) => n.exerciseId)).toEqual(['squat', 'bench']);
    expect(await repo.notes.set(p.id, 'bench', '   ')).toBeUndefined();
    expect(await repo.notes.set(p.id, 'deadlift', '')).toBeUndefined();
    expect((await repo.notes.list(p.id)).map((n) => n.exerciseId)).toEqual(['squat']);
    expect(await repo.notes.list(p.id, { includeDeleted: true })).toHaveLength(2);
    const ops = (await repo.outbox.peek(100)).filter((o) => o.table === 'exercise_notes').map((o) => o.op);
    // bench upsert, squat upsert, bench delete; the deadlift no-op queues nothing
    expect(ops).toEqual(['upsert', 'upsert', 'delete']);
    await expectCode(repo.notes.set(p.id, '', 'x'), 'VALIDATION');
    await expectCode(repo.notes.set(p.id, 'bench', 5 as unknown as string), 'VALIDATION');
    await expectCode(repo.notes.set('ghost', 'bench', 'x'), 'NOT_FOUND');
  });

  it('arsenal: newest first, includeDeleted, remove of unknown is a no-op, add validates', async () => {
    const { repo, tick } = freshRepo();
    const p = await repo.profiles.create({ name: 'A' });
    await repo.arsenal.add(p.id, 'bench');
    tick();
    await repo.arsenal.add(p.id, 'row');
    expect((await repo.arsenal.list(p.id)).map((e) => e.exerciseId)).toEqual(['row', 'bench']);
    await repo.arsenal.remove(p.id, 'bench');
    await repo.arsenal.remove(p.id, 'never-added');
    expect((await repo.arsenal.list(p.id)).map((e) => e.exerciseId)).toEqual(['row']);
    expect(await repo.arsenal.list(p.id, { includeDeleted: true })).toHaveLength(2);
    await expectCode(repo.arsenal.add(p.id, ''), 'VALIDATION');
    await expectCode(repo.arsenal.add('ghost', 'bench'), 'NOT_FOUND');
  });

  it('equipment: validates lists, dedupes, rejects unknown keys, missing profile is NOT_FOUND', async () => {
    const { repo } = freshRepo();
    const p = await repo.profiles.create({ name: 'A' });
    const saved = await repo.equipment.save(p.id, { kettlebellsKg: [24, 16, 24], stationIds: ['SMITH', 'SMITH'], bodyweightGear: ['rings', 'pull-up-bar'] });
    expect(saved).toMatchObject({ kettlebellsKg: [16, 24], stationIds: ['SMITH'], bodyweightGear: ['rings', 'pull-up-bar'] });
    const bad: Array<Record<string, unknown>> = [
      { stationIds: 'SMITH' },
      { attachmentIds: [''] },
      { bodyweightGear: ['trampoline'] },
      { kettlebellsKg: 16 },
      { kettlebellsKg: [0] },
      { colour: 'red' },
    ];
    for (const patch of bad) await expectCode(repo.equipment.save(p.id, patch as Partial<EquipmentInventory>), 'VALIDATION');
    await expectCode(repo.equipment.save('ghost', {}), 'NOT_FOUND');
    const ignored = await repo.equipment.save(p.id, { id: 'x', profileId: 'y', createdAt: 'z' } as Partial<EquipmentInventory>);
    expect(ignored).toMatchObject({ id: p.id, profileId: p.id, createdAt: saved.createdAt, stationIds: ['SMITH'] });
  });

  it('prs.list filters by exercise and hides records of a deleted workout unless asked', async () => {
    const { repo } = freshRepo();
    const p = await repo.profiles.create({ name: 'A' });
    await repo.finishWorkout(draft('w1', p.id, [exercise('u1', 'bench', [{ kg: 60, reps: 5 }]), exercise('u2', 'squat', [{ kg: 80, reps: 5 }])]));
    // 2 exercises × (e1rm + weight) = 4 baseline rows
    expect(await repo.prs.list(p.id)).toHaveLength(4);
    expect((await repo.prs.list(p.id, { exerciseId: 'squat' })).map((r) => r.prType).sort()).toEqual(['e1rm', 'weight']);
    expect(await repo.prs.list(p.id, { limit: 3 })).toHaveLength(3);
    await repo.logs.softDelete(p.id, 'w1');
    expect(await repo.prs.list(p.id)).toEqual([]);
    expect(await repo.prs.best(p.id, 'squat')).toEqual({});
    expect(await repo.prs.list(p.id, { exerciseId: 'squat', includeDeleted: true })).toHaveLength(2);
  });
});
