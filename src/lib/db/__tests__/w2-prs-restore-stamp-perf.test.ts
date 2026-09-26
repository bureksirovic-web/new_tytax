/**
 * PR recompute on restore, LWW-safe rebuild stamps and edit cost over 1000 logs (refuter findings, Wave 2).
 *
 * Hand-derived values (Brzycki, 5 reps -> kg x 1.125):
 *   A 100x5: weight 100, e1rm 112.5   B 110x5: weight 110, e1rm 123.75
 *   A edited to 120x5: weight 120, e1rm 135
 */
import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { sequentialIds } from '@/contracts/fixtures';
import { createContext } from '../repo/context';
import { rebuildAllPRs } from '../repo/prs';
import { T0, draft, exercise, fakeSync, freshRepo, type TestRepo } from './helpers';

const DAY = 86_400_000;

async function finish(t: TestRepo, id: string, pid: string, kg: number) {
  t.tick(DAY);
  return t.repo.finishWorkout(draft(id, pid, [exercise(`u-${id}`, 'bench', [{ kg, reps: 5 }])], { startedAt: t.now().toISOString() }));
}

async function setKg(t: TestRepo, pid: string, id: string, kg: number) {
  const log = await t.repo.logs.get(pid, id);
  if (!log) throw new Error(`missing ${id}`);
  t.tick();
  return t.repo.logs.update(pid, id, { exercises: log.exercises.map((ex) => ({ ...ex, sets: ex.sets.map((s) => ({ ...s, kg })) })) });
}

const ctxOf = (t: TestRepo) => createContext({ db: () => t.db, sync: () => fakeSync(false), now: t.now, newId: sequentialIds('rb') });

describe('restore re-derives the restored log', () => {
  it('B deleted, A raised to 120, B restored: B (110 < 120) claims no PRs', async () => {
    const t = freshRepo();
    const pid = (await t.repo.profiles.create({ name: 'P' })).id;
    await finish(t, 'A', pid, 100);
    await finish(t, 'B', pid, 110);
    t.tick();
    await t.repo.logs.softDelete(pid, 'B');
    await setKg(t, pid, 'A', 120);
    t.tick();
    await t.repo.logs.restore(pid, 'B');
    const b = await t.repo.logs.get(pid, 'B');
    const liveRowsOfB = (await t.repo.prs.list(pid)).filter((r) => r.workoutLogId === 'B');
    // Expected: B beats nothing (110 < 120, 123.75 < 135) -> prCount 0, no isPR, no live rows.
    // A full rebuild agrees and finds work to do if restore left stale state.
    const counts = await rebuildAllPRs(ctxOf(t), pid);
    expect({ prCount: b?.prCount, isPR: b?.exercises[0].sets[0].isPR, rows: liveRowsOfB.length, rebuildTombstoned: counts.tombstoned }).toEqual({
      prCount: 0,
      isPR: undefined,
      rows: 0,
      rebuildTombstoned: 0,
    });
  });
});

describe('rebuild stamps never move updatedAt backwards', () => {
  it('a later log with a future updatedAt is re-annotated 1 ms after that stamp', async () => {
    const t = freshRepo();
    const pid = (await t.repo.profiles.create({ name: 'P' })).id;
    await finish(t, 'A', pid, 100);
    await finish(t, 'B', pid, 110);
    await finish(t, 'C', pid, 105);
    const future = new Date(T0.getTime() + 365 * DAY).toISOString();
    const c0 = await t.db.workoutLogs.get('C');
    if (!c0) throw new Error('C');
    await t.db.workoutLogs.put({ ...c0, updatedAt: future }); // as pulled from a device with a fast clock
    t.tick();
    await t.repo.logs.softDelete(pid, 'B'); // C now beats A: prCount 0 -> 2, rewritten
    const c1 = await t.db.workoutLogs.get('C');
    expect(c1?.prCount).toBe(2);
    // LWW: a rewrite must not move updatedAt backwards (sync would drop or revert it).
    expect(c1?.updatedAt).toBe(new Date(Date.parse(future) + 1).toISOString());
  });
});

describe('edit cost over 1000 logs', () => {
  it('editing the first of 1000 logs (all later re-derived) finishes < 2 s', async () => {
    const src = freshRepo();
    const pid = (await src.repo.profiles.create({ name: 'P' })).id;
    await finish(src, 'seed', pid, 50);
    const backup = await src.repo.exportBackup(pid);
    const [tpl] = backup.workoutLogs;
    // kg 50..1049 rising: every log i >= 1 is a PR over log i-1 (weight and e1rm).
    const logs = Array.from({ length: 1000 }, (_, i) => {
      const day = new Date(T0.getTime() + i * DAY);
      const ex = tpl.exercises[0];
      return { ...tpl, id: `L${String(i).padStart(4, '0')}`, date: day.toISOString().slice(0, 10), startedAt: day.toISOString(), finishedAt: day.toISOString(), exercises: [{ ...ex, sets: [{ ...ex.sets[0], kg: 50 + i }] }] };
    });
    const dst = freshRepo({ start: new Date(T0.getTime() + 2000 * DAY) });
    await dst.repo.importBackup({ ...backup, workoutLogs: logs, prRecords: [] });
    await rebuildAllPRs(ctxOf(dst), pid);
    dst.tick();
    const t0 = performance.now();
    await setKg(dst, pid, 'L0000', 5000); // L0000 beats every later log: all 999 lose both PRs
    const ms = performance.now() - t0;
    expect((await dst.repo.logs.get(pid, 'L0999'))?.prCount).toBe(0);
    expect(ms).toBeLessThan(2000);
  }, 60_000);
});
