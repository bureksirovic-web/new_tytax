import type { WorkoutLog } from '@/types/workout';
import { brzycki } from '@/lib/workout/e1rm';

export interface E1RMDataPoint {
  date: string;
  exerciseId: string;
  weight: number;
  reps: number;
  e1rm: number;
}

export function getE1RMProgression(
  logs: WorkoutLog[],
  exerciseId: string
): E1RMDataPoint[] {
  const byDay = new Map<string, E1RMDataPoint>();

  const sorted = [...logs].sort((a, b) => a.date.localeCompare(b.date));

  for (const log of sorted) {
    for (const ex of log.exercises) {
      if (ex.exerciseRef !== exerciseId) continue;
      for (const set of ex.sets) {
        if (!set.done || set.reps === 0 || set.kg === 0) continue;
        const e1rm = brzycki(set.kg, set.reps);
        const existing = byDay.get(log.date);
        if (!existing || e1rm > existing.e1rm) {
          byDay.set(log.date, {
            date: log.date,
            exerciseId,
            weight: set.kg,
            reps: set.reps,
            e1rm,
          });
        }
      }
    }
  }

  return Array.from(byDay.values()).sort((a, b) => a.date.localeCompare(b.date));
}

export function getBestLifts(
  logs: WorkoutLog[]
): Record<string, { weight: number; reps: number; e1rm: number; date: string }> {
  const best: Record<string, { weight: number; reps: number; e1rm: number; date: string }> = {};

  for (const log of logs) {
    for (const ex of log.exercises) {
      for (const set of ex.sets) {
        if (!set.done || set.reps === 0 || set.kg === 0) continue;
        const e1rm = brzycki(set.kg, set.reps);
        const prev = best[ex.exerciseRef];
        if (!prev || e1rm > prev.e1rm) {
          best[ex.exerciseRef] = {
            weight: set.kg,
            reps: set.reps,
            e1rm,
            date: log.date,
          };
        }
      }
    }
  }

  return best;
}
