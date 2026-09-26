/** Pure helpers for the dashboard's pinned-exercises card. */
import type { SetEntry, WorkoutLog } from '@/contracts/domain';
import * as trainingModule from '@/lib/training';
import { isDoneWorkingSet, training } from '@/lib/training';

/** Local copy of G1's F3 cap, used only while `@/lib/training` does not export `E1RM_MAX_REPS`. */
const FALLBACK_E1RM_MAX_REPS = 12;

/**
 * Highest rep count an e1RM is ranked for. Reads G1's `E1RM_MAX_REPS` at runtime
 * when the training module exports it (Wave 2, F3), else the same value locally.
 */
export function e1rmMaxReps(mod: unknown = trainingModule): number {
  const value = (mod as { E1RM_MAX_REPS?: unknown } | undefined)?.E1RM_MAX_REPS;
  return typeof value === 'number' && value > 0 ? value : FALLBACK_E1RM_MAX_REPS;
}

/** A done working set that yields a rankable e1RM: reps-measured, kg > 0, 1..maxReps reps. */
function rankable(s: SetEntry, maxReps: number): boolean {
  return isDoneWorkingSet(s) && s.durationSeconds === undefined && s.kg > 0 && s.reps <= maxReps;
}

export interface LatestBest {
  /** Best e1RM of the latest qualifying session, kg. */
  e1rm: number;
  /** Local calendar day of that session. */
  date: string;
  logId: string;
}

function startedMs(log: WorkoutLog): number {
  const ms = Date.parse(log.startedAt);
  return Number.isNaN(ms) ? 0 : ms;
}

/**
 * Best e1RM (kg) of `exerciseId` in the newest live log that has a rankable set of it,
 * or null. Warm-ups, undone sets, time sets and sets above `maxReps` never count.
 */
export function latestBestE1rm(
  logs: readonly WorkoutLog[],
  exerciseId: string,
  maxReps: number = e1rmMaxReps(),
): LatestBest | null {
  const newestFirst = logs
    .filter((l) => !l.deletedAt)
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date) || startedMs(b) - startedMs(a));
  for (const log of newestFirst) {
    let best = 0;
    for (const ex of log.exercises) {
      if (ex.exerciseId !== exerciseId) continue;
      for (const s of ex.sets) {
        if (rankable(s, maxReps)) best = Math.max(best, training.e1rm(s.kg, s.reps));
      }
    }
    if (best > 0) return { e1rm: best, date: log.date, logId: log.id };
  }
  return null;
}
