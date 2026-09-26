/** Pure helpers for the dashboard's pinned-exercises card. */
import type { SetEntry, WorkoutLog } from '@/contracts/domain';
import { localRankableE1rm, rankableE1rmG1 } from '@/components/analytics/g1-adapters';

export { e1rmMaxReps } from '@/components/analytics/g1-adapters';

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
 * Ranked by G1's `rankableE1rm` when exported (local copy otherwise); an explicit
 * `maxReps` forces the local rule with that cap.
 */
export function latestBestE1rm(
  logs: readonly WorkoutLog[],
  exerciseId: string,
  maxReps?: number,
): LatestBest | null {
  const rank = maxReps === undefined ? rankableE1rmG1 : (s: SetEntry) => localRankableE1rm(s, maxReps);
  const newestFirst = logs
    .filter((l) => !l.deletedAt)
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date) || startedMs(b) - startedMs(a));
  for (const log of newestFirst) {
    let best = 0;
    for (const ex of log.exercises) {
      if (ex.exerciseId !== exerciseId) continue;
      for (const s of ex.sets) {
        best = Math.max(best, rank(s) ?? 0);
      }
    }
    if (best > 0) return { e1rm: best, date: log.date, logId: log.id };
  }
  return null;
}
