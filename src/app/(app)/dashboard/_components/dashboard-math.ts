/**
 * Pure dashboard calculations (no React, no repository): ISO-week volume,
 * today's predicted program session, plural categories.
 */
import type { Program, ProgramSession, WorkoutLog } from '@/contracts/domain';
import { localDay } from '@/lib/utils';

const DAY_MS = 86_400_000;

/** Local calendar day `days` days after (negative: before) `d`, 'YYYY-MM-DD'. */
export function shiftDay(d: Date, days: number): string {
  const copy = new Date(d.getFullYear(), d.getMonth(), d.getDate() + days, 12);
  return localDay(copy);
}

/** Monday (local) of the ISO week containing `now`, 'YYYY-MM-DD'. */
export function isoWeekStart(now: Date): string {
  // getDay(): Sunday 0 … Saturday 6 → days since Monday: (day + 6) % 7.
  return shiftDay(now, -((now.getDay() + 6) % 7));
}

/** Σ kg × reps over done working sets (warm-ups and undone sets never count). */
export function doneWorkingVolume(log: WorkoutLog): number {
  let sum = 0;
  for (const ex of log.exercises) {
    for (const s of ex.sets) {
      if (s.done && s.type !== 'warmup') sum += s.kg * s.reps;
    }
  }
  return sum;
}

export interface WeeklyVolume {
  /** kg, current ISO week (Monday → today). */
  thisWeekKg: number;
  /** kg, the whole previous ISO week. */
  lastWeekKg: number;
  /** Rounded % change vs last week; null when last week had no volume. */
  changePct: number | null;
}

/** Range the dashboard loads: last week's Monday through today. */
export function volumeRangeStart(now: Date): string {
  const monday = isoWeekStart(now);
  const [y, m, d] = monday.split('-').map(Number);
  return shiftDay(new Date(y, m - 1, d, 12), -7);
}

/**
 * This ISO week vs last, from non-deleted logs of the active profile.
 * Weeks run Monday–Sunday on the log's local calendar `date`.
 */
export function weeklyVolume(logs: readonly WorkoutLog[], now: Date): WeeklyVolume {
  const thisMonday = isoWeekStart(now);
  const lastMonday = volumeRangeStart(now);
  let thisWeekKg = 0;
  let lastWeekKg = 0;
  for (const log of logs) {
    if (log.deletedAt) continue;
    if (log.date >= thisMonday) thisWeekKg += doneWorkingVolume(log);
    else if (log.date >= lastMonday) lastWeekKg += doneWorkingVolume(log);
  }
  const changePct = lastWeekKg > 0 ? Math.round(((thisWeekKg - lastWeekKg) / lastWeekKg) * 100) : null;
  return { thisWeekKg, lastWeekKg, changePct };
}

/** Recovery needs logs from the last 48 h: this start day always covers them. */
export function recoveryRangeStart(now: Date): string {
  return localDay(new Date(now.getTime() - 3 * DAY_MS));
}

/**
 * The session the rotation pointer names, wrapped into range exactly like the
 * workout store's `startFromProgram`; undefined for a program without sessions.
 */
export function predictSession(program: Program): { session: ProgramSession; index: number } | undefined {
  const n = program.sessions.length;
  if (n === 0) return undefined;
  const raw = Number.isFinite(program.currentSessionIndex) ? Math.floor(program.currentSessionIndex) : 0;
  const index = ((raw % n) + n) % n;
  return { session: program.sessions[index], index };
}

export type PluralCategory = 'one' | 'few' | 'other';

/** CLDR plural category collapsed to the three forms the dashboard keys carry. */
export function pluralCategory(count: number, locale: string): PluralCategory {
  const c = new Intl.PluralRules(locale).select(count);
  return c === 'one' || c === 'few' ? c : 'other';
}
