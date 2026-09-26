import type { WorkoutLog } from '@/contracts/domain';
import { E1RM_MAX_REPS, e1rm as estimate } from '@/lib/training';
import { countedSets, liveLogs } from './sets';

export interface E1RMDataPointWithExercise {
  date: string;
  exerciseId: string;
  weight: number;
  reps: number;
  e1rm: number;
}

/**
 * Sets that can carry an e1RM estimate: loaded (kg > 0) and at most
 * `E1RM_MAX_REPS` reps (Brzycki is unreliable beyond: 16 kg × 35 → 288 kg).
 */
function estimable(set: { kg: number; reps: number }): boolean {
  return set.kg !== 0 && set.reps <= E1RM_MAX_REPS;
}

/** Best e1RM per day for one exercise (done working sets of ≤ 12 reps of live logs), oldest first. */
export function getE1RMProgression(logs: readonly WorkoutLog[], exerciseId: string): E1RMDataPointWithExercise[] {
  const byDay = new Map<string, E1RMDataPointWithExercise>();

  for (const log of liveLogs(logs)) {
    for (const ex of log.exercises) {
      if (ex.exerciseId !== exerciseId) continue;
      for (const set of countedSets(ex)) {
        if (!estimable(set)) continue;
        const e1rm = estimate(set.kg, set.reps);
        const existing = byDay.get(log.date);
        if (!existing || e1rm > existing.e1rm) {
          byDay.set(log.date, { date: log.date, exerciseId, weight: set.kg, reps: set.reps, e1rm });
        }
      }
    }
  }

  return Array.from(byDay.values()).sort((a, b) => a.date.localeCompare(b.date));
}

/** Best e1RM set (done working set of ≤ 12 reps) per exercise id across all live logs. */
export function getBestLifts(
  logs: readonly WorkoutLog[],
): Record<string, { weight: number; reps: number; e1rm: number; date: string }> {
  const best = new Map<string, { weight: number; reps: number; e1rm: number; date: string }>();

  for (const log of liveLogs(logs)) {
    for (const ex of log.exercises) {
      for (const set of countedSets(ex)) {
        if (!estimable(set)) continue;
        const e1rm = estimate(set.kg, set.reps);
        const prev = best.get(ex.exerciseId);
        if (!prev || e1rm > prev.e1rm) {
          best.set(ex.exerciseId, { weight: set.kg, reps: set.reps, e1rm, date: log.date });
        }
      }
    }
  }

  return Object.fromEntries(best);
}
