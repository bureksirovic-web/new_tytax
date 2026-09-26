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
  /** kg, current ISO week (Monday → now). */
  thisWeekKg: number;
  /** kg, the whole previous ISO week. */
  lastWeekKg: number;
  /** kg, the previous ISO week up to the same weekday and time as now (the fair comparison). */
  lastWeekToDateKg: number;
  /** Rounded % change of this week so far vs last week up to the same point; null when that was 0. */
  changePct: number | null;
}

/** Range the dashboard loads: last week's Monday through today. */
export function volumeRangeStart(now: Date): string {
  const monday = isoWeekStart(now);
  const [y, m, d] = monday.split('-').map(Number);
  return shiftDay(new Date(y, m - 1, d, 12), -7);
}

/** Same weekday and wall-clock time one calendar week before `now` (DST-safe: calendar fields). */
export function sameTimeLastWeek(now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7, now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
}

/** When a log counts as done: `finishedAt`, else `startedAt`; NaN when neither parses. */
function logTimeMs(log: WorkoutLog): number {
  const f = Date.parse(log.finishedAt);
  return Number.isNaN(f) ? Date.parse(log.startedAt) : f;
}

/**
 * This ISO week so far vs last, from non-deleted logs of the active profile.
 * Weeks run Monday–Sunday on the log's local calendar `date`. The % change
 * compares against last week up to the same weekday and time (a log counts by
 * its end time; without a parsable time, by its day), so Monday morning never
 * reads as a collapse against a whole finished week.
 */
export function weeklyVolume(logs: readonly WorkoutLog[], now: Date): WeeklyVolume {
  const thisMonday = isoWeekStart(now);
  const lastMonday = volumeRangeStart(now);
  const cutoff = sameTimeLastWeek(now);
  const cutoffMs = cutoff.getTime();
  const cutoffDay = localDay(cutoff);
  let thisWeekKg = 0;
  let lastWeekKg = 0;
  let lastWeekToDateKg = 0;
  for (const log of logs) {
    if (log.deletedAt) continue;
    if (log.date >= thisMonday) thisWeekKg += doneWorkingVolume(log);
    else if (log.date >= lastMonday) {
      const kg = doneWorkingVolume(log);
      lastWeekKg += kg;
      const t = logTimeMs(log);
      if (Number.isNaN(t) ? log.date <= cutoffDay : t <= cutoffMs) lastWeekToDateKg += kg;
    }
  }
  const changePct =
    lastWeekToDateKg > 0 ? Math.round(((thisWeekKg - lastWeekToDateKg) / lastWeekToDateKg) * 100) : null;
  return { thisWeekKg, lastWeekKg, lastWeekToDateKg, changePct };
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
