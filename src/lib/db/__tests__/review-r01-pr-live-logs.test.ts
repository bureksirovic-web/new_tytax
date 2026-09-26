/**
 * R01 (WAVE0_REVIEW, G2): PR bests follow the live workout logs, not only the
 * stored PR records. Covers log edits, soft delete/restore, and history that
 * arrives without PR records (seedHistory / importBackup / migration writes).
 */
import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import type { WorkoutLog } from '@/contracts/domain';
import { training } from '@/lib/training';
import { draft, exercise, freshRepo, type TestRepo } from './helpers';

const e1 = (kg: number, reps: number) => Math.round(training.e1rm(kg, reps) * 100) / 100;

async function finish(t: TestRepo, id: string, profileId: string, kg: number, reps = 5) {
  t.tick(3_600_000);
  return t.repo.finishWorkout(draft(id, profileId, [exercise(`u-${id}`, 'bench', [{ kg, reps }])], { startedAt: t.now().toISOString() }));
}

const prTypes = (r: { prs: Array<{ prType: string; isBaseline: boolean }> }) =>
  r.prs.filter((c) => !c.isBaseline).map((c) => c.prType).sort();

describe('R01: a corrected fat-finger set stops blocking PRs', () => {
  it('1000x5 edited to 100x5, then 110x5 is an e1rm + weight PR', async () => {
    const t = freshRepo();
    const p = await t.repo.profiles.create({ name: 'A' });
    await finish(t, 'w1', p.id, 100);
    const typo = await finish(t, 'w2', p.id, 1000);
    const [ex] = typo.log.exercises;
    const fixed = [{ ...ex, sets: ex.sets.map((s) => ({ ...s, kg: 100 })) }];
    t.tick();
    const edited = await t.repo.logs.update(p.id, 'w2', { exercises: fixed });

    // The edited log is re-annotated: no PR flag, e1rm follows the new weight.
    expect(edited.prCount).toBe(0);
    expect(edited.exercises[0].sets[0].isPR).toBeUndefined();
    expect(edited.exercises[0].sets[0].e1rm).toBeCloseTo(training.e1rm(100, 5), 6);
    // Its 1000 kg records no longer count.
    const best = await t.repo.prs.best(p.id, 'bench');
    expect(best.weight?.value).toBe(100);
    expect(best.weight?.workoutLogId).toBe('w1');

    const next = await finish(t, 'w3', p.id, 110);
    expect(prTypes(next)).toEqual(['e1rm', 'weight']);
    expect(next.prs.find((c) => c.prType === 'weight')?.previousBest).toBe(100);
    expect(next.prs.find((c) => c.prType === 'e1rm')?.previousBest).toBe(e1(100, 5));
    expect(next.log.prCount).toBe(2);
  });

  it('an edit that raises a set makes it a PR of that log', async () => {
    const t = freshRepo();
    const p = await t.repo.profiles.create({ name: 'A' });
    await finish(t, 'w1', p.id, 100);
    const low = await finish(t, 'w2', p.id, 90);
    const [ex] = low.log.exercises;
    t.tick();
    const edited = await t.repo.logs.update(p.id, 'w2', { exercises: [{ ...ex, sets: ex.sets.map((s) => ({ ...s, kg: 120 })) }] });
    expect(edited.prCount).toBe(2);
    expect(edited.exercises[0].sets[0].isPR).toBe(true);
    expect((await t.repo.prs.best(p.id, 'bench')).weight?.workoutLogId).toBe('w2');
    const next = await finish(t, 'w3', p.id, 110);
    expect(next.prs).toEqual([]);
  });
});

describe('R01: soft delete and restore', () => {
  it("a deleted log's PR no longer blocks; restoring it blocks again", async () => {
    const t = freshRepo();
    const p = await t.repo.profiles.create({ name: 'A' });
    await finish(t, 'w1', p.id, 70);
    await finish(t, 'w2', p.id, 100);
    await t.repo.logs.softDelete(p.id, 'w2');
    expect(prTypes(await finish(t, 'w3', p.id, 80))).toEqual(['e1rm', 'weight']);
    await t.repo.logs.restore(p.id, 'w2');
    expect((await finish(t, 'w4', p.id, 90)).prs).toEqual([]);
  });

  it('a deleted log whose PR records are already gone still does not count', async () => {
    const t = freshRepo();
    const p = await t.repo.profiles.create({ name: 'A' });
    await finish(t, 'w1', p.id, 70);
    await finish(t, 'w2', p.id, 100);
    // A synced tombstone for the log only (its records never arrived).
    const w2 = (await t.db.workoutLogs.get('w2')) as WorkoutLog;
    await t.db.workoutLogs.put({ ...w2, deletedAt: t.now().toISOString() });
    expect(prTypes(await finish(t, 'w3', p.id, 80))).toEqual(['e1rm', 'weight']);
  });
});

describe('R01: history written without PR records', () => {
  it('importBackup (seedHistory path) logs are respected: equal/lower is no PR, no baseline re-fires', async () => {
    const src = freshRepo();
    const a = await src.repo.profiles.create({ name: 'A' });
    await finish(src, 'w1', a.id, 100);
    const backup = await src.repo.exportBackup(a.id);
    expect(backup.prRecords.length).toBeGreaterThan(0);

    const t = freshRepo({ start: new Date(src.now().getTime()) });
    await t.repo.importBackup({ ...backup, prRecords: [] });
    expect(await t.db.prRecords.count()).toBe(0);

    const same = await finish(t, 'w2', a.id, 100);
    expect(same.prs).toEqual([]);
    expect(same.log.prCount).toBe(0);
    expect((await finish(t, 'w3', a.id, 90)).prs).toEqual([]);
    const up = await finish(t, 'w4', a.id, 105);
    expect(prTypes(up)).toEqual(['e1rm', 'weight']);
    expect(up.prs.every((c) => !c.isBaseline)).toBe(true);
  });

  it('a migration-style raw log write (no PR rows) is respected', async () => {
    const t = freshRepo();
    const p = await t.repo.profiles.create({ name: 'A' });
    const seed = await finish(t, 'w1', p.id, 100);
    await t.db.prRecords.clear();
    expect((await t.db.workoutLogs.get('w1'))?.id).toBe(seed.log.id);
    const r = await finish(t, 'w2', p.id, 100);
    expect(r.prs).toEqual([]);
    expect(await t.db.prRecords.count()).toBe(0);
  });

  it('warm-up and not-done sets in history do not raise the bests', async () => {
    const t = freshRepo();
    const p = await t.repo.profiles.create({ name: 'A' });
    t.tick(3_600_000);
    await t.repo.finishWorkout(
      draft('w1', p.id, [exercise('u1', 'bench', [{ kg: 100, reps: 5 }, { kg: 200, reps: 5, type: 'warmup' }, { kg: 300, reps: 5, done: false }])], {
        startedAt: t.now().toISOString(),
      }),
    );
    expect(prTypes(await finish(t, 'w2', p.id, 110))).toEqual(['e1rm', 'weight']);
  });

  it('other profiles do not leak into the bests', async () => {
    const t = freshRepo();
    const a = await t.repo.profiles.create({ name: 'A' });
    const b = await t.repo.profiles.create({ name: 'B' });
    await finish(t, 'wa', a.id, 200);
    await finish(t, 'wb1', b.id, 100);
    expect(prTypes(await finish(t, 'wb2', b.id, 110))).toEqual(['e1rm', 'weight']);
  });
});
