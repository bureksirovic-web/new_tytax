import type { SetEntry, WorkoutLog } from '@/contracts/domain';
import { clean, isDoneWorkingSet, isTimeSet } from './common';

/**
 * Seconds held over time sets (F2): Σ `durationSeconds` over done working
 * (non-warm-up) time sets, i.e. sets where both `isDoneWorkingSet` and
 * `isTimeSet` hold. Warm-ups, undone sets and reps-only sets add 0; a
 * non-finite duration is ignored. Float noise is trimmed to 1e-6.
 */
export function holdSeconds(sets: readonly SetEntry[]): number {
  let total = 0;
  for (const s of sets) {
    if (!isDoneWorkingSet(s) || !isTimeSet(s)) continue;
    const d = s.durationSeconds ?? 0;
    if (Number.isFinite(d)) total += d;
  }
  return clean(total);
}

/** `holdSeconds` over every exercise of one log (the caller filters deleted logs). */
export function logHoldSeconds(log: WorkoutLog): number {
  let total = 0;
  for (const ex of log.exercises) total += holdSeconds(ex.sets);
  return clean(total);
}
