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

/**
 * A time set can be marked done once it has a duration above 0 s (kg and reps
 * are not needed), or — duration left empty — when a ghost exists: done/Enter
 * then adopts it (`toggleTimeSetDone`), the ghost-reps rule. `ghost` is the
 * card's hint for the row; the set's own `ghostDurationSeconds` counts too.
 */
export function canCompleteTimeSet(set: Pick<SetEntry, 'durationSeconds' | 'ghostDurationSeconds'>, ghost?: number): boolean {
  return setSeconds(set) > 0 || (ghostSecondsOf(set.ghostDurationSeconds) ?? ghostSecondsOf(ghost)) !== undefined;
}

/** The done button of a time set: usable to complete a timed (or ghosted) set, and always to undo. */
export function canToggleTimeDone(set: Pick<SetEntry, 'durationSeconds' | 'ghostDurationSeconds' | 'done'>, ghost?: number): boolean {
  return set.done || canCompleteTimeSet(set, ghost);
}

/** Ghost duration for the placeholder: a positive whole number of seconds, else undefined. */
export function ghostSecondsOf(value: number | undefined): number | undefined {
  const s = cleanSeconds(value);
  return s > 0 ? s : undefined;
}

/**
 * Ghost duration for each set of a card, aligned with `sets`: the set's own
 * `ghostDurationSeconds` (filled by the session builder from history) wins;
 * else the n-th working (non-warm-up) set gets `last[n]` (a set added during
 * the workout, or a draft built before the field existed). Warm-ups and
 * positions last session did not have get undefined.
 */
export function ghostSecondsForSets(
  sets: ReadonlyArray<Pick<SetEntry, 'type' | 'ghostDurationSeconds'>>,
  last: ReadonlyArray<number | undefined>,
): Array<number | undefined> {
  let working = 0;
  return sets.map((s) => {
    if (s.type === 'warmup') return undefined;
    const ghost = ghostSecondsOf(s.ghostDurationSeconds) ?? ghostSecondsOf(last[working]);
    working += 1;
    return ghost;
  });
}
