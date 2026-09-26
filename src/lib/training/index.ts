/**
 * Training engine (implements `TrainingApi` from src/contracts/training.ts).
 * Wave 0 skeleton: e1rm and detectPRs are real; the rest are filled in by the
 * Wave 0 training pass (see src/lib/training/*.ts).
 */
import type {
  DetectPRsFn,
  E1rmFn,
  PRCandidate,
  TrainingApi,
} from '@/contracts/training';
import type { PRType, SetEntry } from '@/contracts/domain';
import { RepoError } from '@/contracts/repo';

export const e1rm: E1rmFn = (kg, reps) => {
  if (!(kg > 0) || !(reps > 0)) return 0;
  if (reps === 1) return kg;
  if (reps >= 37) return kg * (1 + reps / 30);
  return (kg * 36) / (37 - reps);
};

/** Done sets that count as training: not warm-ups. */
export function isDoneWorkingSet(s: SetEntry): boolean {
  return s.done && s.type !== 'warmup' && s.kg >= 0 && s.reps > 0;
}

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
        const prev = bests[ex.exerciseId]?.[prType];
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

function notYet(name: string): never {
  throw new RepoError('NOT_IMPLEMENTED', `training.${name} is not implemented yet`);
}

export const training: TrainingApi = {
  e1rm,
  detectPRs,
  generateWarmups: () => notYet('generateWarmups'),
  prefillFromHistory: () => notYet('prefillFromHistory'),
  impactDistribution: () => notYet('impactDistribution'),
  laggingMuscle: () => notYet('laggingMuscle'),
  recoveryStatus: () => notYet('recoveryStatus'),
  acwr: () => notYet('acwr'),
  deload: () => notYet('deload'),
};
