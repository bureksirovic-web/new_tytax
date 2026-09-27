/** Input validation helpers; every failure is a `RepoError('VALIDATION')`. */
import { localDay } from '@/contracts/fixtures';
import { RepoError } from '@/contracts/repo';

// ─── Validation ──────────────────────────────────────────────────────────────

const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isCalendarDay(v: unknown): v is string {
  if (typeof v !== 'string') return false;
  const m = DAY_RE.exec(v);
  if (!m) return false;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

export function assertDay(v: unknown, field: string): asserts v is string {
  if (!isCalendarDay(v)) throw new RepoError('VALIDATION', `${field} must be a 'YYYY-MM-DD' date`);
}

export function isIsoTimestamp(v: unknown): v is string {
  return typeof v === 'string' && v.length >= 10 && Number.isFinite(Date.parse(v));
}

export function assertTimestamp(v: unknown, field: string): asserts v is string {
  if (!isIsoTimestamp(v)) throw new RepoError('VALIDATION', `${field} must be an ISO timestamp`);
}

export function assertNonNegative(v: unknown, field: string): asserts v is number {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) {
    throw new RepoError('VALIDATION', `${field} must be a finite number >= 0`);
  }
}

/** Hold time of a set: an integer number of seconds, 0 to 24 h. */
export const MAX_SET_SECONDS = 86_400;
export function assertDurationSeconds(v: unknown, field: string): asserts v is number {
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 0 || v > MAX_SET_SECONDS) {
    throw new RepoError('VALIDATION', `${field} must be an integer 0-${MAX_SET_SECONDS} seconds`);
  }
}

export function assertPositive(v: unknown, field: string): asserts v is number {
  if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0) {
    throw new RepoError('VALIDATION', `${field} must be a finite number > 0`);
  }
}

/** Earliest accepted `Profile.birthYear` (family-profiles plan, setup-link payload cap). */
export const MIN_BIRTH_YEAR = 1920;

/** An integer year, `MIN_BIRTH_YEAR`..the current calendar year (`now`). */
export function assertBirthYear(v: unknown, field: string, now: Date = new Date()): asserts v is number {
  const max = now.getFullYear();
  if (typeof v !== 'number' || !Number.isInteger(v) || v < MIN_BIRTH_YEAR || v > max) {
    throw new RepoError('VALIDATION', `${field} must be an integer year ${MIN_BIRTH_YEAR}-${max}`);
  }
}

export function assertNonEmpty(v: unknown, field: string): asserts v is string {
  if (typeof v !== 'string' || v.trim() === '') throw new RepoError('VALIDATION', `${field} must not be empty`);
}

export function notFound(what: string, id: string): RepoError {
  return new RepoError('NOT_FOUND', `${what} ${id} not found`);
}

/**
 * `WorkoutLog.date` of an edited log: the local calendar day of its `startedAt`
 * (domain.ts), derived as finishWorkout derives it. A patched `startedAt` sets
 * the day; a patched `date` must name that day (or, without a new `startedAt`,
 * keep the stored one), so the two can never disagree after an edit.
 */
export function editedDay(current: { date: string; startedAt: string }, patch: { date?: string; startedAt?: string }): string | undefined {
  if (patch.date !== undefined) assertDay(patch.date, 'date');
  if (patch.startedAt !== undefined) assertTimestamp(patch.startedAt, 'startedAt');
  if (patch.startedAt === undefined && (patch.date === undefined || patch.date === current.date)) return patch.date;
  const day = localDay(new Date(patch.startedAt ?? current.startedAt));
  if (patch.date !== undefined && patch.date !== day) throw new RepoError('VALIDATION', `date must be the local day of startedAt (${day})`);
  return day;
}
