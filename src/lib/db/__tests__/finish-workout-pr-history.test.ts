/**
 * PR detection against a history of more than one stored record per type
 * (AC6 "a non-PR does not fire").
 *
 * The other finishWorkout PR tests hold one prior record per type, where the
 * best and the worst stored value coincide, so a max-to-min flip in
 * existingBests() or dropping its tombstone filter survived the full suite.
 */
import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { draft, exercise, freshRepo } from './helpers';

async function finish(t: ReturnType<typeof freshRepo>, id: string, profileId: string, kg: number) {
  t.tick(3_600_000);
  return t.repo.finishWorkout(draft(id, profileId, [exercise(`u-${id}`, 'bench', [{ kg, reps: 8 }])], { startedAt: t.now().toISOString() }));
}

describe('finishWorkout PR detection over several stored records', () => {
  it('a set below the real best but above the first baseline is not a PR (70x8, 80x8, then 75x8)', async () => {
    const t = freshRepo();
    const p = await t.repo.profiles.create({ name: 'A' });
    await finish(t, 'w1', p.id, 70);
    const second = await finish(t, 'w2', p.id, 80);
    expect(second.log.prCount).toBeGreaterThan(0);
    const storedAfter2 = (await t.repo.prs.list(p.id, { exerciseId: 'bench' })).length;

    const third = await finish(t, 'w3', p.id, 75);
    expect(third.prs).toEqual([]);
    expect(third.log.prCount).toBe(0);
    expect(third.log.exercises.flatMap((e) => e.sets).some((s) => s.isPR)).toBe(false);
    // Checked in the DB, not only in the returned candidates.
    expect(await t.repo.prs.list(p.id, { exerciseId: 'bench' })).toHaveLength(storedAfter2);
    expect((await t.repo.prs.best(p.id, 'bench')).e1rm?.workoutLogId).toBe('w2');
  });

  it('a PR of a deleted workout no longer blocks a new PR (70x8, 100x8 deleted, then 80x8)', async () => {
    const t = freshRepo();
    const p = await t.repo.profiles.create({ name: 'A' });
    const first = await finish(t, 'w1', p.id, 70);
    const baselineE1rm = first.prs.find((c) => c.prType === 'e1rm')?.value;
    await finish(t, 'w2', p.id, 100);
    await t.repo.logs.softDelete(p.id, 'w2');

    const third = await finish(t, 'w3', p.id, 80);
    expect(third.log.prCount).toBe(2);
    const e1rm = third.prs.find((c) => c.prType === 'e1rm');
    expect(e1rm?.isBaseline).toBe(false);
    expect(baselineE1rm).toBeDefined();
    expect(e1rm?.previousBest).toBe(baselineE1rm);
    expect(e1rm?.previousBest).toBeCloseTo(86.9, 1);
    expect((await t.repo.prs.best(p.id, 'bench')).e1rm?.workoutLogId).toBe('w3');
  });
});
