/**
 * Pure rules for time-measured set rows (Wave 2, F2). No React, no store;
 * unit tested in __tests__/set-time-rules.test.ts.
 */
import type { ExerciseMeasure, SetEntry } from '@/contracts/domain';
import { cleanSeconds, isTimeSet } from '@/stores/measure';

/** The row's measure: the caller's (catalog) measure, else a set carrying `durationSeconds` is a time set. */
export function rowMeasure(set: Pick<SetEntry, 'durationSeconds'>, measure?: ExerciseMeasure): ExerciseMeasure {
  return isTimeSet(set, measure) ? 'time' : 'reps';
}

/** Whole seconds recorded on the set (0 when none). */
export function setSeconds(set: Pick<SetEntry, 'durationSeconds'>): number {
  return cleanSeconds(set.durationSeconds);
}

/** A time set can be marked done once it has a duration above 0 s (kg and reps are not needed). */
export function canCompleteTimeSet(set: Pick<SetEntry, 'durationSeconds'>): boolean {
  return setSeconds(set) > 0;
}

/** The done button of a time set: usable to complete a timed set, and always to undo. */
export function canToggleTimeDone(set: Pick<SetEntry, 'durationSeconds' | 'done'>): boolean {
  return set.done || canCompleteTimeSet(set);
}

/** Ghost duration for the placeholder: a positive whole number of seconds, else undefined. */
export function ghostSecondsOf(value: number | undefined): number | undefined {
  const s = cleanSeconds(value);
  return s > 0 ? s : undefined;
}

/**
 * Last session's duration for each set of a card, aligned with `sets`: the
 * n-th working (non-warm-up) set gets `last[n]`; warm-ups and positions last
 * session did not have get undefined.
 */
export function ghostSecondsForSets(
  sets: ReadonlyArray<Pick<SetEntry, 'type'>>,
  last: ReadonlyArray<number | undefined>,
): Array<number | undefined> {
  let working = 0;
  return sets.map((s) => {
    if (s.type === 'warmup') return undefined;
    const ghost = ghostSecondsOf(last[working]);
    working += 1;
    return ghost;
  });
}
