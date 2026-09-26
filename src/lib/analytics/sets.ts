/**
 * What analytics counts: done working sets (training-contract rule) of
 * non-deleted logs. Warm-ups and undone sets never count.
 */
import type { SessionExercise, SetEntry, WorkoutLog } from '@/contracts/domain';
import { isDoneWorkingSet } from '@/lib/training';

export function liveLogs(logs: readonly WorkoutLog[]): WorkoutLog[] {
  return logs.filter((l) => !l.deletedAt);
}

export function countedSets(ex: SessionExercise): SetEntry[] {
  return ex.sets.filter(isDoneWorkingSet);
}

/** Σ kg × reps over counted sets of one exercise. */
export function exerciseVolume(ex: SessionExercise): number {
  return countedSets(ex).reduce((sum, s) => sum + s.kg * s.reps, 0);
}

/** Σ kg × reps over counted sets of one log. */
export function logVolume(log: WorkoutLog): number {
  return log.exercises.reduce((sum, ex) => sum + exerciseVolume(ex), 0);
}

/** Local calendar day `days` before `now`, 'YYYY-MM-DD'. */
export function dayCutoff(now: Date, days: number): string {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
