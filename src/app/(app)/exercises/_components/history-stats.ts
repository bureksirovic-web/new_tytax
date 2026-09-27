/**
 * Per-exercise history math (pure). Counting rule: only done sets that are not
 * warm-ups, in logs without `deletedAt`. e1RM only from rankable sets
 * (`rankableE1rm` from `@/lib/training`, ≤ `E1RM_MAX_REPS` reps), kept at its 0.01 kg so
 * /exercises and /analytics format the same number (display rounds once, after unit conversion).
 */
import type { SetEntry, WorkoutLog } from '@/contracts/domain';
import { isTimeSet, rankableE1rm } from '@/lib/training';

/** Done working sets of `exerciseId` in one log (the exercise may appear more than once). */
export function doneWorkingSets(log: WorkoutLog, exerciseId: string): SetEntry[] {
  if (log.deletedAt) return [];
  return log.exercises
    .filter((e) => e.exerciseId === exerciseId)
    .flatMap((e) => e.sets)
    .filter((s) => s.done && s.type !== 'warmup');
}

/** A set logged as a hold/duration (Wave 2 F2): no e1RM, no kg volume. `isTimeSet` from `@/lib/training`. */
export const isTimedSet = (s: SetEntry): boolean => isTimeSet(s);

/** Best e1RM (kg, `rankableE1rm` precision; never pre-rounded) over the given sets; 0 when none qualifies. Time sets and sets above the rep cap never qualify. */
export function bestE1rm(sets: readonly SetEntry[]): number {
  let best = 0;
  for (const s of sets) best = Math.max(best, rankableE1rm(s) ?? 0);
  return best;
}

/** Longest duration (whole seconds) over the given sets; 0 when none has one. */
export function longestHold(sets: readonly SetEntry[]): number {
  let best = 0;
  for (const s of sets) if (isTimedSet(s) && Number.isFinite(s.durationSeconds)) best = Math.max(best, Math.round(s.durationSeconds!));
  return Math.max(0, best);
}

export interface HoldPoint {
  logId: string;
  date: string;
  seconds: number;
}

/** The session with the longest hold (earliest on ties), or undefined. */
export function bestHold(logs: readonly WorkoutLog[], exerciseId: string): HoldPoint | undefined {
  let best: HoldPoint | undefined;
  for (const log of logs) {
    const seconds = longestHold(doneWorkingSets(log, exerciseId));
    if (seconds > 0 && (!best || seconds > best.seconds || (seconds === best.seconds && log.date < best.date)))
      best = { logId: log.id, date: log.date, seconds };
  }
  return best;
}

/** Duration parts for display: under a minute → seconds only, else minutes + zero-padded seconds. */
export function durationParts(totalSeconds: number): { m: number; s: number; ss: string } {
  const t = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(t / 60);
  const s = t % 60;
  return { m, s, ss: String(s).padStart(2, '0') };
}

export interface E1rmPoint {
  logId: string;
  date: string;
  e1rm: number;
}

/** Oldest → newest, one point per log with at least one qualifying set. */
export function e1rmSeries(logs: readonly WorkoutLog[], exerciseId: string): E1rmPoint[] {
  const points: E1rmPoint[] = [];
  for (const log of logs) {
    const value = bestE1rm(doneWorkingSets(log, exerciseId));
    if (value > 0) points.push({ logId: log.id, date: log.date, e1rm: value });
  }
  return points.sort((a, b) => (a.date === b.date ? 0 : a.date < b.date ? -1 : 1));
}

/** The highest point (earliest on ties), or undefined. */
export function bestPoint(points: readonly E1rmPoint[]): E1rmPoint | undefined {
  let best: E1rmPoint | undefined;
  for (const p of points) if (!best || p.e1rm > best.e1rm) best = p;
  return best;
}
