/**
 * How a set is measured (Wave 2, F2). Pure helpers, no React.
 *
 * - `measureOf(ex)` → `ex.measure` (G1 tags every time-target exercise of the
 *   catalog 'time'); untagged or unknown → 'reps' (the contract default). The
 *   former `defaultReps` heuristic is gone: on G1's catalog it agreed with the
 *   tag on all 1566 exercises (92 time, 0 disagreements; see measure.test.ts).
 * - `isTimeSet(set, measure?)` → true for a set of a 'time' exercise. Without a
 *   measure (the store and selectors do not see the catalog), a set that carries
 *   a `durationSeconds` number is a time set.
 * - `formatDuration(seconds)` → "m:ss" ("0:45", "2:05", "12:00"); negative,
 *   NaN and infinite input read as 0, fractions are rounded down.
 * - `parseDuration(text)` → seconds or undefined: "45", "1:30", "01:05".
 *   More than `MAX_SET_SECONDS` (24 h) is undefined (rejected input).
 * - `cleanSeconds` caps at `MAX_SET_SECONDS`: G2's log validation
 *   (`assertDurationSeconds`, g2/src/lib/db/repo/validate.ts) rejects longer
 *   sets, which would make the workout impossible to finish.
 */
import type { Exercise, ExerciseMeasure, SetEntry } from '@/contracts/domain';

export type { ExerciseMeasure } from '@/contracts/domain';

export function measureOf(ex: Pick<Exercise, 'measure'> | undefined): ExerciseMeasure {
  return ex?.measure ?? 'reps';
}

export function isTimeSet(set: Pick<SetEntry, 'durationSeconds'>, measure?: ExerciseMeasure): boolean {
  if (measure !== undefined) return measure === 'time';
  return typeof set.durationSeconds === 'number';
}

/** Longest set duration the repository accepts (G2 `MAX_SET_SECONDS`). */
export const MAX_SET_SECONDS = 86_400;

/** Whole, non-negative seconds capped at 24 h (NaN, ±Infinity and negatives → 0). */
export function cleanSeconds(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value) || value <= 0) return 0;
  return Math.min(Math.floor(value), MAX_SET_SECONDS);
}

export function formatDuration(seconds: number): string {
  const total = cleanSeconds(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

const MM_SS = /^\s*(\d{1,4})\s*:\s*([0-5]?\d)\s*$/;
const SECONDS = /^\s*(\d{1,6})\s*$/;

export function parseDuration(text: string): number | undefined {
  const mmss = MM_SS.exec(text);
  const secs = mmss ? undefined : SECONDS.exec(text);
  const total = mmss ? Number(mmss[1]) * 60 + Number(mmss[2]) : secs ? Number(secs[1]) : undefined;
  return total !== undefined && total <= MAX_SET_SECONDS ? total : undefined;
}
