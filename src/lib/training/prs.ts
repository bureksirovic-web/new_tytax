import type { PRType } from '@/contracts/domain';
import type { DetectPRsFn, PRCandidate } from '@/contracts/training';
import { isDoneWorkingSet } from './common';
import { e1rm } from './e1rm';

/**
 * e1RM estimates from high-rep sets are unreliable (Brzycki diverges as reps
 * approach 37: 16 kg × 35 → 288 kg), so e1RM PRs come only from sets of at
 * most this many reps. Weight and reps PRs are unaffected.
 */
export const E1RM_PR_MAX_REPS = 12;

/**
 * PRs in a workout, at most one per (exerciseId, prType), compared with the
 * stored best:
 * - `e1rm`: best done working set by e1RM (rounded to 0.01 kg), reps ≤ 12;
 * - `weight`: heaviest done working set;
 * - `reps`: most reps in one done working set at 0 kg (bodyweight work,
 *   which can never set an e1RM or weight PR).
 * Strictly greater only; a first-ever value is a baseline (`isBaseline`,
 * `previousBest: null`). Ties inside the workout keep the earlier set.
 */
export const detectPRs: DetectPRsFn = (exercises, bests) => {
  const bestByKey = new Map<string, PRCandidate>();
  for (const ex of exercises) {
    for (const s of ex.sets) {
      if (!isDoneWorkingSet(s)) continue;
      const values: Array<[PRType, number]> = [['weight', s.kg]];
      if (s.reps <= E1RM_PR_MAX_REPS) values.unshift(['e1rm', Math.round(e1rm(s.kg, s.reps) * 100) / 100]);
      if (s.kg === 0) values.push(['reps', s.reps]);
      for (const [prType, value] of values) {
        if (!(value > 0)) continue;
        const key = `${ex.exerciseId}::${prType}`;
        const current = bestByKey.get(key);
        if (current && current.value >= value) continue;
        const own = Object.prototype.hasOwnProperty.call(bests, ex.exerciseId) ? bests[ex.exerciseId] : undefined;
        const prev = own?.[prType];
        bestByKey.set(key, {
          exerciseId: ex.exerciseId,
          exerciseName: ex.exerciseName,
          prType,
          value,
          kg: s.kg,
          reps: s.reps,
          setId: s.id,
          sessionExerciseUid: ex.uid,
          previousBest: prev ?? null,
          isBaseline: prev === undefined,
        });
      }
    }
  }
  return [...bestByKey.values()].filter((c) => c.previousBest === null || c.value > c.previousBest);
};
