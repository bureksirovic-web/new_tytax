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

/** Whole local calendar days from `a` to `b` (DST-safe: compares local midnights). */
function calendarDaysBetween(a: Date, b: Date): number {
  const ma = new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime();
  const mb = new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime();
  return Math.round((mb - ma) / 86_400_000);
}

/**
 * Youth rest-day rule: a rest day is marked done only once it has actually
 * passed, never rushed and never skipped. `program.updatedAt` is stamped by the
 * last advance (a finished workout or a completed rest day).
 * - Rest slot right after a training slot: needs 2 calendar days since that
 *   workout (Mon workout -> Tue is the rest day -> done from Wed, then train Wed).
 * - Rest slot right after another rest slot: needs 1 more calendar day
 *   (Fri workout, Sat + Sun rest -> first done Sun, second done Mon).
 * Adults, profiles without a birth year, and unknown timestamps are never locked.
 * The action itself stays available (otherwise a youth rotation could never
 * pass a rest day); the orchestrator refuses it while locked.
 */
export function restDayLocked(
  profile: Pick<Profile, 'birthYear'> | undefined,
  program: Pick<Program, 'updatedAt' | 'sessions' | 'currentSessionIndex'> | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!isYouth(profile, now) || !program?.updatedAt || program.sessions.length === 0) return false;
  const last = new Date(program.updatedAt);
  if (Number.isNaN(last.getTime())) return false;
  const n = program.sessions.length;
  const index = ((program.currentSessionIndex % n) + n) % n;
  const previous = program.sessions[(index - 1 + n) % n];
  const previousWasRest = previous.isRest === true || previous.exercises.length === 0;
  return calendarDaysBetween(last, now) < (previousWasRest ? 1 : 2);
}

/** `PrefillOptions` a youth profile's session builder passes through to `prefillFromHistory`. */
export function youthPrefillOptions(): Pick<PrefillOptions, 'maxIncrementKg'> {
  return { maxIncrementKg: YOUTH_MAX_INCREMENT_KG };
}
