import type { PRType, SetEntry } from '@/contracts/domain';
import type { DetectPRsFn, PRCandidate } from '@/contracts/training';
import { isDoneWorkingSet, isTimeSet, isWorkingType } from './common';
import { e1rm } from './e1rm';

/**
 * e1RM estimates from high-rep sets are unreliable (Brzycki diverges as reps
 * approach 37: 16 kg × 35 → 288 kg), so every e1RM figure (PRs here, the
 * analytics best lifts and e1RM progression) comes only from sets of at most
 * this many reps. Weight and reps PRs are unaffected.
 */
export const E1RM_MAX_REPS = 12;
/** Alias of `E1RM_MAX_REPS` (the cap was first introduced for PRs). */
export const E1RM_PR_MAX_REPS = E1RM_MAX_REPS;

/**
 * The e1RM a set may be ranked by (PRs, best lifts, e1RM progression), or
 * undefined when it may not: not done, a warm-up, a time set (`isTimeSet`),
 * kg ≤ 0, reps ≤ 0 or reps > `E1RM_MAX_REPS`. Otherwise `e1rm(kg, reps)`
 * (Brzycki; Epley at 37+ never applies under the cap) rounded to 0.01 kg.
 * `e1rm()` itself is unchanged; this is the single eligibility rule.
 */
export function rankableE1rm(set: Pick<SetEntry, 'kg' | 'reps' | 'durationSeconds' | 'done' | 'type'>): number | undefined {
  if (!set.done || !isWorkingType(set.type) || isTimeSet(set)) return undefined;
  if (!(set.kg > 0) || !(set.reps > 0) || set.reps > E1RM_MAX_REPS) return undefined;
  return Math.round(e1rm(set.kg, set.reps) * 100) / 100;
}

/**
 * PRs in a workout, at most one per (exerciseId, prType), compared with the
 * stored best:
 * - `e1rm`: best done working set by e1RM (rounded to 0.01 kg), reps ≤ 12;
 * - `weight`: heaviest done working set;
 * - `reps`: most reps in one done working set at 0 kg (bodyweight work,
 *   which can never set an e1RM or weight PR).
 * Time sets (`isTimeSet`: seconds held) yield no candidate of any type.
 * The e1RM rule is `rankableE1rm`. Strictly greater only; a first-ever value is a baseline (`isBaseline`,
 * `previousBest: null`). Ties inside the workout keep the earlier set.
 */
export const detectPRs: DetectPRsFn = (exercises, bests) => {
  const bestByKey = new Map<string, PRCandidate>();
  for (const ex of exercises) {
    for (const s of ex.sets) {
      if (!isDoneWorkingSet(s) || isTimeSet(s)) continue;
      const values: Array<[PRType, number]> = [['weight', s.kg]];
      const est = rankableE1rm(s);
      if (est !== undefined) values.unshift(['e1rm', est]);
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
