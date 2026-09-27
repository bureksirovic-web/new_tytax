/**
 * Youth mode (family-profiles plan, 2026-09-27): a profile under 16 trains
 * lighter and safer by default.
 *
 * - `ageFromBirthYear`: whole years, calendar-year based (no month/day in
 *   `Profile.birthYear`), so it is +-1 year of the real age.
 * - `isYouth`: age < `YOUTH_AGE_LIMIT` (16). A profile with no `birthYear`
 *   is never youth (opt-in data, never assumed).
 * - `youthPrefillOptions`: the `PrefillOptions` youth mode passes to
 *   `training.prefillFromHistory` (see prefill.ts for how `maxIncrementKg`
 *   is honoured: capped automatic increases, and no increase at all when
 *   the last session's basis was RIR 2 — only RIR >=3 progresses a youth
 *   profile's load).
 */
import type { Profile, Program } from '@/contracts/domain';
import type { PrefillOptions } from '@/contracts/training';

/** Under this age (in whole years), youth mode applies. */
export const YOUTH_AGE_LIMIT = 16;

/** Upper bound on a youth profile's automatic load increase, kg. */
export const YOUTH_MAX_INCREMENT_KG = 1.25;

/** Whole years between `birthYear` and `now`'s calendar year (+-1 real year, no birth month recorded). */
export function ageFromBirthYear(birthYear: number, now: Date = new Date()): number {
  return now.getFullYear() - birthYear;
}

/** True when `profile.birthYear` is set and names an age under `YOUTH_AGE_LIMIT`. */
export function isYouth(profile: Pick<Profile, 'birthYear'> | undefined, now: Date = new Date()): boolean {
  if (!profile || profile.birthYear === undefined) return false;
  return ageFromBirthYear(profile.birthYear, now) < YOUTH_AGE_LIMIT;
}

function localDay(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/**
 * Youth rest-day rule: a rest day can be completed, never rushed. For a youth
 * profile the "rest day done" action is locked while the active program was
 * last advanced (a finished workout or a completed rest day, both stamp
 * `program.updatedAt`) on the same local calendar day as `now`. Adults are
 * never locked. Without this lock a youth rotation (A, Rest, B, ...) could be
 * advanced through its rest days in one sitting; without the action at all it
 * could never pass a rest day.
 */
export function restDayLocked(
  profile: Pick<Profile, 'birthYear'> | undefined,
  program: Pick<Program, 'updatedAt'> | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!isYouth(profile, now) || !program?.updatedAt) return false;
  const last = new Date(program.updatedAt);
  return !Number.isNaN(last.getTime()) && localDay(last) === localDay(now);
}

/** `PrefillOptions` a youth profile's session builder passes through to `prefillFromHistory`. */
export function youthPrefillOptions(): Pick<PrefillOptions, 'maxIncrementKg'> {
  return { maxIncrementKg: YOUTH_MAX_INCREMENT_KG };
}
