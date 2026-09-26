/**
 * finishWorkout / logs.update leave exactly the state a full rebuild derives:
 * back-dated finishes re-derive later logs, a finishedAt edit moves PR rows'
 * achievedAt, duplicate set ids are rejected (refuter findings, Wave 2).
 *
 * Hand-derived values (Brzycki, 5 reps -> kg x 1.125):
 *   100x5: weight 100, e1rm 112.5   110x5: weight 110, e1rm 123.75
 *   120x5: weight 120, e1rm 135     130x5: weight 130, e1rm 146.25
 *   50x5:  weight 50,  e1rm 56.25
 */
import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { sequentialIds } from '@/contracts/fixtures';
import { createContext } from '../repo/context';
import { rebuildAllPRs } from '../repo/prs';
import { T0, draft, exercise, fakeSync, freshRepo, type TestRepo } from './helpers';

const DAY = 86_400_000;
const at = (days: number) => new Date(T0.getTime() + days * DAY).toISOString();
const ctxOf = (t: TestRepo) => createContext({ db: () => t.db, sync: () => fakeSync(false), now: t.now, newId: sequentialIds('rb') });

async function finishAt(t: TestRepo, id: string, pid: string, kg: number, days: number) {
  return t.repo.finishWorkout(draft(id, pid, [exercise(`u-${id}`, 'bench', [{ kg, reps: 5 }])], { startedAt: at(days) }));
}

describe('finishWorkout of a back-dated draft', () => {
  it('B (day 2, 130) finished after C (day 3, 120): C loses its PRs to B, a rebuild finds nothing to do', async () => {
    const t = freshRepo({ start: new Date(T0.getTime() + 10 * DAY) });
    const pid = (await t.repo.profiles.create({ name: 'P' })).id;
    await finishAt(t, 'A', pid, 100, 1); // baseline
    await finishAt(t, 'C', pid, 120, 3); // 120 > 100, 135 > 112.5 -> prCount 2
    await finishAt(t, 'B', pid, 130, 2); // chronologically between A and C
    const pc = async (id: string) => (await t.repo.logs.get(pid, id))?.prCount;
    // Chronological truth: A baseline (0); B beats A (130 > 100, 146.25 > 112.5) -> 2;
    // C 120 < 130 and 135 < 146.25 -> 0. B's finish re-derives C, so a full rebuild tombstones nothing.
    const observed = [await pc('A'), await pc('B'), await pc('C')];
    t.tick();
    const counts = await rebuildAllPRs(ctxOf(t), pid);
    expect({ observed, rebuildTombstoned: counts.tombstoned }).toEqual({ observed: [0, 2, 0], rebuildTombstoned: 0 });
  });
});

describe('logs.update of finishedAt only', () => {
  it('moves the PR rows\' achievedAt with it (sets carry no completedAt, so achievedAt = log.finishedAt)', async () => {
    const t = freshRepo();
    const pid = (await t.repo.profiles.create({ name: 'P' })).id;
    await finishAt(t, 'A', pid, 100, 1);
    await finishAt(t, 'B', pid, 110, 2); // 2 PR rows, achievedAt = finish stamp T0
    t.tick(3 * DAY);
    const fin = new Date(T0.getTime() + 2 * DAY + 3_600_000).toISOString();
    await t.repo.logs.update(pid, 'B', { finishedAt: fin });
    const rows = (await t.repo.prs.list(pid)).filter((r) => r.workoutLogId === 'B');
    // Expected: both B rows follow the log (recordsFor: completedAt ?? log.finishedAt).
    expect(rows.map((r) => r.achievedAt)).toEqual([fin, fin]);
  });
});

describe('duplicate ids inside a draft', () => {
  it('a 50x5 set sharing the 110x5 PR set id is rejected (isPR is keyed by uid::setId)', async () => {
    const t = freshRepo();
    const pid = (await t.repo.profiles.create({ name: 'P' })).id;
    await finishAt(t, 'A', pid, 100, 1);
    const ex = exercise('u-B', 'bench', [{ kg: 110, reps: 5 }, { kg: 50, reps: 5 }]);
    ex.sets[1] = { ...ex.sets[1], id: ex.sets[0].id };
    // Accepted, both sets would be flagged isPR ([true, true]): validation rejects the draft instead.
    await expect(t.repo.finishWorkout(draft('B', pid, [ex], { startedAt: at(2) }))).rejects.toMatchObject({ code: 'VALIDATION' });
    expect(await t.repo.logs.get(pid, 'B')).toBeUndefined();
  });

  it('two exercises sharing a uid are rejected, by finishWorkout and by logs.update', async () => {
    const t = freshRepo();
    const pid = (await t.repo.profiles.create({ name: 'P' })).id;
    const a = exercise('u-same', 'bench', [{ kg: 100, reps: 5 }]);
    const b = exercise('u-same', 'squat', [{ kg: 100, reps: 5 }]);
    await expect(t.repo.finishWorkout(draft('B', pid, [a, b], { startedAt: at(2) }))).rejects.toMatchObject({ code: 'VALIDATION' });
    await finishAt(t, 'A', pid, 100, 1);
    await expect(t.repo.logs.update(pid, 'A', { exercises: [a, b] })).rejects.toMatchObject({ code: 'VALIDATION' });
  });
});
