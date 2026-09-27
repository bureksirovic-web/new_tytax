import type { PRType } from '@/contracts/domain';
import type { DetectPRsFn, PRCandidate } from '@/contracts/training';
import { isDoneWorkingSet } from './common';
import { e1rm } from './e1rm';

/**
 * PRs in a workout, at most one per (exerciseId, prType): the best done
 * working set by e1RM (rounded to 0.01 kg) and by weight, compared with the
 * stored best. Strictly greater only; a first-ever value is a baseline
 * (`isBaseline`, `previousBest: null`). Ties inside the workout keep the
 * earlier set.
 */
export const detectPRs: DetectPRsFn = (exercises, bests) => {
  const bestByKey = new Map<string, PRCandidate>();
  for (const ex of exercises) {
    for (const s of ex.sets) {
      if (!isDoneWorkingSet(s)) continue;
      const values: Array<[PRType, number]> = [
        ['e1rm', Math.round(e1rm(s.kg, s.reps) * 100) / 100],
        ['weight', s.kg],
      ];
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
