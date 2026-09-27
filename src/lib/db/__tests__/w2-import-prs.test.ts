/**
 * Wave 2 G2 item 2 (S2, G3-02): importBackup re-derives PR rows from the
 * imported history in the same transaction.
 *
 * Hand-derived values (Brzycki, 5 reps -> kg x 36/32 = kg x 1.125):
 *   w1 bench 100x5 -> first ever: baselines e1rm 112.5 + weight 100, prCount 0
 *   w2 bench 120x5 -> e1rm 135 > 112.5 and weight 120 > 100: 2 real PRs, prCount 2
 *     (prCount counts PR types, one per (exercise, type); 120x5 beats both.)
 */
import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import type { BackupV3 } from '@/contracts/repo';
import { draft, exercise, fakeSync, freshRepo, type TestRepo } from './helpers';

const DAY = 86_400_000;

async function finish(t: TestRepo, id: string, profileId: string, kg: number) {
  t.tick(DAY);
  return t.repo.finishWorkout(draft(id, profileId, [exercise(`u-${id}`, 'bench', [{ kg, reps: 5 }])], { startedAt: t.now().toISOString() }));
}

/** A backup of one finished 100x5 bench log with its PR rows stripped (the G3-02 shape). */
async function strippedBackup(): Promise<{ backup: BackupV3; profileId: string; after: Date }> {
  const src = freshRepo();
  await src.repo.profiles.create({ name: 'unused' }); // takes id-1, so Ana (id-2) never collides with a destination's first profile
  const p = await src.repo.profiles.create({ name: 'Ana' });
  await finish(src, 'w1', p.id, 100);
  const backup = await src.repo.exportBackup(p.id);
  // Destination clock one minute after every stamp in the backup.
  return { backup: { ...backup, prRecords: [] }, profileId: p.id, after: new Date(src.now().getTime() + 60_000) };
}

describe('G3-02: importBackup writes PR rows derived from the imported history', () => {
  it('imported 100x5 is the stored baseline; a later 120x5 is a real PR', async () => {
    const { backup, profileId, after } = await strippedBackup();
    const t = freshRepo({ start: after, sync: fakeSync() });
    await t.repo.importBackup(backup);
    const rows = await t.repo.prs.list(profileId);
    // 2 baseline rows: e1rm 112.5, weight 100 (sorted by prType).
    expect(rows.map((r) => [r.prType, r.value, r.workoutLogId])).toEqual([['e1rm', 112.5, 'w1'], ['weight', 100, 'w1']]);
    expect((await t.repo.logs.get(profileId, 'w1'))?.prCount).toBe(0);

    const r = await finish(t, 'w2', profileId, 120);
    expect(r.prs.map((c) => [c.prType, c.value, c.isBaseline])).toEqual([['e1rm', 135, false], ['weight', 120, false]]);
    expect(r.log.prCount).toBe(2);
    expect(r.log.exercises[0].sets[0].isPR).toBe(true);
    const best = await t.repo.prs.best(profileId, 'bench');
    expect([best.e1rm?.workoutLogId, best.weight?.value]).toEqual(['w2', 120]);
  });

  it('stale imported annotations (isPR / prCount 1 on the only log) are corrected', async () => {
    const { backup, profileId, after } = await strippedBackup();
    const [log] = backup.workoutLogs;
    const stale = { ...log, prCount: 1, exercises: [{ ...log.exercises[0], sets: [{ ...log.exercises[0].sets[0], isPR: true }] }] };
    const t = freshRepo({ start: after });
    await t.repo.importBackup({ ...backup, workoutLogs: [stale] });
    const saved = await t.repo.logs.get(profileId, 'w1');
    expect(saved?.prCount).toBe(0);
    expect(saved?.exercises[0].sets[0].isPR).toBeUndefined();
    expect(saved?.exercises[0].sets[0].e1rm).toBe(112.5);
    expect(saved?.updatedAt).toBe(after.toISOString());
  });

  it('re-importing the same backup writes nothing and queues nothing', async () => {
    const { backup, profileId, after } = await strippedBackup();
    const [log] = backup.workoutLogs;
    const stale = { ...log, prCount: 1 };
    const t = freshRepo({ start: after, sync: fakeSync() });
    await t.repo.importBackup({ ...backup, workoutLogs: [stale] });
    // Profile + 1 log written; rebuild: log re-annotated (1) + 2 PR rows = 5 outbox ops.
    expect(await t.repo.outbox.count()).toBe(5);
    const snapshot = await t.repo.exportBackup(profileId);
    t.tick(60_000);
    expect(await t.repo.importBackup({ ...backup, workoutLogs: [stale] })).toEqual({ inserted: 0, updated: 0 });
    expect(await t.repo.importBackup(await t.repo.exportBackup(profileId))).toEqual({ inserted: 0, updated: 0 });
    expect(await t.repo.outbox.count()).toBe(5);
    expect({ ...(await t.repo.exportBackup(profileId)), exportedAt: snapshot.exportedAt }).toEqual(snapshot);
  });

  it('a throw after the import rolls back its rows and the derived PR rows together', async () => {
    const { backup, profileId, after } = await strippedBackup();
    const t = freshRepo({ start: after, sync: fakeSync() });
    const run = t.repo.transaction(async () => {
      await t.repo.importBackup(backup);
      expect(await t.db.prRecords.count()).toBe(2);
      throw new Error('boom');
    });
    await expect(run).rejects.toThrow('boom');
    expect([await t.db.profiles.count(), await t.db.workoutLogs.count(), await t.db.prRecords.count()]).toEqual([0, 0, 0]);
    expect(await t.repo.outbox.count()).toBe(0);
    expect(await t.repo.profiles.get(profileId)).toBeUndefined();
  });

  it('only profiles whose logs or PR rows were written are rebuilt', async () => {
    const { backup, after } = await strippedBackup();
    const t = freshRepo({ start: after });
    const other = await t.repo.profiles.create({ name: 'B' });
    await finish(t, 'b1', other.id, 80);
    await t.db.prRecords.clear(); // B's history without PR rows (migration shape): left alone.
    await t.repo.importBackup(backup);
    expect(await t.repo.prs.list(other.id)).toEqual([]);
    // Profile row only (no logs, no PR rows): nothing to rebuild for B either.
    const bOnly = await t.repo.exportBackup(other.id);
    await t.repo.importBackup({ ...bOnly, profiles: [{ ...bOnly.profiles[0], name: 'B2', updatedAt: t.now().toISOString() }], workoutLogs: [] });
    expect(await t.repo.prs.list(other.id)).toEqual([]);
  });
});
