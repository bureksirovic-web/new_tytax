import type { SessionExercise, SetEntry } from '@/contracts/domain';
import type { DeloadFn } from '@/contracts/training';
import { roundTo } from './common';

/** Deload load factor: −15 %. */
export const DELOAD_FACTOR = 0.85;

/**
 * Deload a planned session (the original app's "Recovery Protocol": −1 set,
 * −15 % load). Per exercise: the last non-warm-up set is removed when there
 * is more than one; every remaining non-warm-up set's kg × 0.85 is rounded
 * to `roundToKg` (default 1.25). Warm-ups are untouched. Input is never
 * mutated: exercises and sets are copied.
 */
export const deload: DeloadFn = (exercises, opts) => {
  const inc = opts?.roundToKg ?? 1.25;
  return exercises.map((ex): SessionExercise => {
    let lastWorkIdx = -1;
    let workCount = 0;
    ex.sets.forEach((s, i) => {
      if (s.type !== 'warmup') {
        lastWorkIdx = i;
        workCount += 1;
      }
    });
    const sets: SetEntry[] = [];
    ex.sets.forEach((s, i) => {
      if (s.type === 'warmup') {
        sets.push({ ...s });
        return;
      }
      if (workCount > 1 && i === lastWorkIdx) return;
      sets.push({ ...s, kg: roundTo(s.kg * DELOAD_FACTOR, inc) });
    });
    return { ...ex, sets };
  });
};
