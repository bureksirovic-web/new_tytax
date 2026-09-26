/**
 * Calendar alignment of a program rotation (legacy getPredictedSession
 * L6157-6161, request G4-16). Pure; every day is a local 'YYYY-MM-DD'.
 * Ported from G4's tested local adapter `src/components/programs/lib/rotation.ts`.
 */

const DAY_MS = 86_400_000;

/**
 * 'YYYY-MM-DD' → local midnight (never `new Date('YYYY-MM-DD')`, which is UTC).
 * Null for any other shape or a day that does not exist (e.g. 2026-02-30).
 */
export function parseLocalDate(day: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  const date = new Date(y, mo, d);
  date.setFullYear(y); // years 0–99 would otherwise map to 1900–1999
  if (Number.isNaN(date.getTime()) || date.getFullYear() !== y || date.getMonth() !== mo || date.getDate() !== d) return null;
  return date;
}

/** The local calendar day of `now` as 'YYYY-MM-DD'. */
export function todayLocal(now: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

/** Whole local days from `a` to `b` (negative when b is earlier). DST-safe: a 23 h or 25 h day rounds to 1. */
export function daysBetweenLocal(a: string, b: string): number | null {
  const da = parseLocalDate(a);
  const db = parseLocalDate(b);
  if (!da || !db) return null;
  return Math.round((db.getTime() - da.getTime()) / DAY_MS);
}

/**
 * Index into an `n`-session rotation for `todayDay` when session 0 fell on
 * `startDay`: ((diff % n) + n) % n, so a start in the future wraps backwards.
 * Null for an invalid day or when `n` is not a positive integer.
 */
export function rotationIndexForDate(startDay: string, todayDay: string, n: number): number | null {
  if (!Number.isInteger(n) || n <= 0) return null;
  const diff = daysBetweenLocal(startDay, todayDay);
  if (diff === null) return null;
  return ((diff % n) + n) % n;
}
