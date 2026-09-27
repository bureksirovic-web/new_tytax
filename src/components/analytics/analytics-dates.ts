/**
 * Local-calendar date helpers for analytics. Days are 'YYYY-MM-DD' in the
 * device's time zone; never `toISOString().slice(0, 10)` (that is UTC).
 */
import type { WorkoutLog } from '@/contracts/domain';

export const DAY_MS = 86_400_000;

/** Local calendar day of `d`, 'YYYY-MM-DD'. */
export function localDay(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Local midnight of a 'YYYY-MM-DD' day (never UTC). */
export function parseDay(day: string): Date {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

/** `day` shifted by `n` calendar days (DST-safe: works on calendar fields, not ms). */
export function shiftDay(day: string, n: number): string {
  const d = parseDay(day);
  return localDay(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n));
}

/** Monday of the local week containing `day`. */
export function mondayOf(day: string): string {
  const d = parseDay(day);
  const offset = (d.getDay() + 6) % 7; // Mon → 0 … Sun → 6
  return shiftDay(day, -offset);
}

/** Whole local calendar days from `from` to `to` (to − from). */
export function daysBetween(from: string, to: string): number {
  const a = parseDay(from);
  const b = parseDay(to);
  const utcA = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const utcB = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((utcB - utcA) / DAY_MS);
}

/** Epoch ms when a workout ended (`finishedAt`, else `startedAt`); NaN if neither parses. */
export function logTimeMs(log: WorkoutLog): number {
  const f = Date.parse(log.finishedAt);
  return Number.isNaN(f) ? Date.parse(log.startedAt) : f;
}
