import type { SetEntry, WorkoutLog } from '@/contracts/domain';
import { e1rm as estimate, rankableE1rm } from '@/lib/training';
import { countedSets, liveLogs } from './sets';

export interface E1RMDataPointWithExercise {
  date: string;
  exerciseId: string;
  weight: number;
  reps: number;
  e1rm: number;
}

/**
 * Sets that can carry an e1RM estimate: the training engine's single rule,
 * `rankableE1rm` (done, not a warm-up, not a time set, kg > 0, 1 ≤ reps ≤
 * `E1RM_MAX_REPS`; Brzycki is unreliable beyond: 16 kg × 35 → 288 kg). The
 * charted value stays the unrounded `e1rm(kg, reps)`.
 */
function estimable(set: SetEntry): boolean {
  return rankableE1rm(set) !== undefined;
}

/** Best e1RM per day for one exercise (done working sets of ≤ 12 reps of live logs, time sets skipped), oldest first. */
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

/** Best e1RM set (done working set of ≤ 12 reps, not a time set) per exercise id across all live logs. */
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
