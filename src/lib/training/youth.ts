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
import type { Profile } from '@/contracts/domain';
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

/** `PrefillOptions` a youth profile's session builder passes through to `prefillFromHistory`. */
export function youthPrefillOptions(): Pick<PrefillOptions, 'maxIncrementKg'> {
  return { maxIncrementKg: YOUTH_MAX_INCREMENT_KG };
}
