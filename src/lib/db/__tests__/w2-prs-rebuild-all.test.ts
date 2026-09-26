/**
 * Wave 2 G2 item 1: the G4-47 repro as a repo-level test, and the internal
 * `rebuildAllPRs(ctx, profileId)` import/restore will call.
 *
 * Hand-derived values (Brzycki e1RM, 5 reps -> kg x 1.125):
 *   A 100x5 -> baselines e1rm 112.5 + weight 100 (2 rows, prCount 0)
 *   B 110x5 -> PRs e1rm 123.75 + weight 110 (2 rows, prCount 2)
 *   C 105x5 -> e1rm 118.13 / weight 105, below B: no rows, prCount 0
 */
import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { sequentialIds } from '@/contracts/fixtures';
import { createContext } from '../repo/context';
import { rebuildAllPRs } from '../repo/prs';
import { draft, exercise, fakeSync, freshRepo, type TestRepo } from './helpers';

const DAY = 86_400_000;

async function finish(t: TestRepo, id: string, profileId: string, kg: number) {
  t.tick(DAY);
  return t.repo.finishWorkout(draft(id, profileId, [exercise(`u-${id}`, 'bench', [{ kg, reps: 5 }])], { startedAt: t.now().toISOString() }));
}

const ctxOf = (t: TestRepo) => createContext({ db: () => t.db, sync: () => fakeSync(false), now: t.now, newId: sequentialIds('rb') });

describe('G4-47 repro: editing the PR set away recomputes prCount', () => {
  it('an imported log claiming 100x5 isPR / prCount 1, edited to 60x5, has no PR', async () => {
    const src = freshRepo();
    const p = await src.repo.profiles.create({ name: 'Ana' });
    await finish(src, 'w1', p.id, 100);
    const backup = await src.repo.exportBackup(p.id);
    const [log] = backup.workoutLogs;
    // Stale client-side annotations and no PR rows, as in the G4 repro.
    const stale = { ...log, prCount: 1, exercises: [{ ...log.exercises[0], sets: [{ ...log.exercises[0].sets[0], isPR: true }] }] };
    const dst = freshRepo();
    await dst.repo.importBackup({ ...backup, workoutLogs: [stale], prRecords: [] });
    const [ex] = stale.exercises;
    await dst.repo.logs.update(p.id, 'w1', { exercises: [{ ...ex, sets: ex.sets.map((s) => ({ ...s, kg: 60 })) }] });
    const saved = await dst.repo.logs.get(p.id, 'w1');
    // The only log is a baseline: 60 x 1.125 = 67.5 e1rm, no PR.
    expect(saved?.exercises[0].sets[0].isPR).toBeUndefined();
    expect(saved?.exercises[0].sets[0].e1rm).toBe(67.5);
    expect(saved?.prCount).toBe(0);
    expect(saved?.totalVolumeKg).toBe(300);
  });
});

describe('rebuildAllPRs', () => {
  async function stripped() {
    const t = freshRepo();
    const p = await t.repo.profiles.create({ name: 'A' });
    for (const [id, kg] of [['A', 100], ['B', 110], ['C', 105]] as const) await finish(t, id, p.id, kg);
    // Simulate history written without PR bookkeeping (import, migration).
    await t.db.prRecords.clear();
    await t.db.workoutLogs.toCollection().modify((l) => {
      l.prCount = 0;
      for (const ex of l.exercises) for (const s of ex.sets) delete s.isPR;
    });
    return { t, pid: p.id };
  }

  it('derives rows, isPR and prCount from all live logs', async () => {
    const { t, pid } = await stripped();
    expect(await rebuildAllPRs(ctxOf(t), pid)).toEqual({ inserted: 4, updated: 0, tombstoned: 0 });
    const counts = await Promise.all(['A', 'B', 'C'].map(async (id) => (await t.repo.logs.get(pid, id))?.prCount));
    expect(counts).toEqual([0, 2, 0]);
    expect((await t.repo.logs.get(pid, 'B'))?.exercises[0].sets[0].isPR).toBe(true);
    const best = await t.repo.prs.best(pid, 'bench');
    expect([best.weight?.workoutLogId, best.weight?.value, best.e1rm?.value]).toEqual(['B', 110, 123.75]);
  });

  it('is idempotent: a second run writes nothing', async () => {
    const { t, pid } = await stripped();
    await rebuildAllPRs(ctxOf(t), pid);
    const logs = await t.db.workoutLogs.toArray();
    expect(await rebuildAllPRs(ctxOf(t), pid)).toEqual({ inserted: 0, updated: 0, tombstoned: 0 });
    expect(await t.db.workoutLogs.toArray()).toStrictEqual(logs);
  });

  it('fixes a wrong row in place and tombstones rows of missing or deleted logs', async () => {
    const { t, pid } = await stripped();
    await rebuildAllPRs(ctxOf(t), pid);
    const bWeight = (await t.repo.prs.list(pid)).find((r) => r.workoutLogId === 'B' && r.prType === 'weight');
    if (!bWeight) throw new Error('missing B weight row');
    await t.db.prRecords.put({ ...bWeight, value: 999 });
    await t.db.prRecords.put({ ...bWeight, id: 'orphan', workoutLogId: 'gone' });
    // B weight row: value 999 -> 110 (updated 1); orphan row of log 'gone': tombstoned 1.
    expect(await rebuildAllPRs(ctxOf(t), pid)).toEqual({ inserted: 0, updated: 1, tombstoned: 1 });
    expect((await t.db.prRecords.get(bWeight.id))?.value).toBe(110);
    expect((await t.db.prRecords.get('orphan'))?.deletedAt).toBe(t.now().toISOString());
  });

  it('leaves other profiles alone', async () => {
    const { t, pid } = await stripped();
    const other = await t.repo.profiles.create({ name: 'B' });
    await finish(t, 'O', other.id, 50);
    const before = await t.repo.prs.list(other.id, { includeDeleted: true });
    await rebuildAllPRs(ctxOf(t), pid);
    expect(await t.repo.prs.list(other.id, { includeDeleted: true })).toStrictEqual(before);
  });
});
