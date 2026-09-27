/** Pure helpers for the dashboard's pinned-exercises card. */
import type { WorkoutLog } from '@/contracts/domain';
import { rankableE1rm } from '@/lib/training';

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
 * or null. Warm-ups, undone sets, time sets and sets above the rep cap never count.
 * Ranked by `rankableE1rm` from `@/lib/training` (cap `E1RM_MAX_REPS`).
 */
export function latestBestE1rm(logs: readonly WorkoutLog[], exerciseId: string): LatestBest | null {
  const newestFirst = logs
    .filter((l) => !l.deletedAt)
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date) || startedMs(b) - startedMs(a));
  for (const log of newestFirst) {
    let best = 0;
    for (const ex of log.exercises) {
      if (ex.exerciseId !== exerciseId) continue;
      for (const s of ex.sets) {
        best = Math.max(best, rankableE1rm(s) ?? 0);
      }
    }
    if (best > 0) return { e1rm: best, date: log.date, logId: log.id };
  }
  return null;
}
