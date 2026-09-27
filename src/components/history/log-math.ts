/**
 * Pure read-only views over a finished WorkoutLog for the history screens.
 * Counting rule (contract): only done, non-warm-up sets count.
 */
import type { SessionExercise, SetEntry, Units, WorkoutLog } from '@/contracts/domain';
import { formatDate, toDisplayWeight, type Locale } from '@/lib/i18n';
import { parseLocalDay } from '@/lib/utils';
import { isTimeSet } from './duration';

export function countsAsWork(s: SetEntry): boolean {
  return s.done && s.type !== 'warmup';
}

/** Legacy H3: whole minutes, never below 1. */
export function durationMinutes(seconds: number): number {
  return Math.max(1, Math.floor((Number.isFinite(seconds) ? seconds : 0) / 60));
}

/** kg volume of done working kg×reps sets; time sets never add kg volume. */
export function exerciseVolumeKg(ex: SessionExercise): number {
  return ex.sets.reduce((sum, s) => (countsAsWork(s) && !isTimeSet(s) ? sum + s.kg * s.reps : sum), 0);
}

/** Seconds held over done working time sets. */
export function exerciseHoldSeconds(ex: SessionExercise): number {
  return ex.sets.reduce((sum, s) => (countsAsWork(s) && isTimeSet(s) ? sum + (s.durationSeconds ?? 0) : sum), 0);
}

export function logHoldSeconds(log: Pick<WorkoutLog, 'exercises'>): number {
  return log.exercises.reduce((sum, ex) => sum + exerciseHoldSeconds(ex), 0);
}

export function hasTimeSets(ex: SessionExercise): boolean {
  return ex.sets.some(isTimeSet);
}

export function doneWorkingSets(ex: SessionExercise): number {
  return ex.sets.filter(countsAsWork).length;
}

/** Density in display units per minute, rounded to an integer. */
export function densityPerMin(log: WorkoutLog, units: Units): number {
  return Math.round(toDisplayWeight(log.totalVolumeKg / durationMinutes(log.durationSeconds), units));
}

/** Mean RIR over done working sets with a recorded RIR, 1 dp; null when none. */
export function averageRir(log: WorkoutLog): number | null {
  const rirs: number[] = [];
  for (const ex of log.exercises) {
    for (const s of ex.sets) if (countsAsWork(s) && s.rir != null) rirs.push(s.rir);
  }
  if (rirs.length === 0) return null;
  return Math.round((rirs.reduce((a, b) => a + b, 0) / rirs.length) * 10) / 10;
}

/** Exercises with at least one done set are shown; the rest are counted as skipped. */
export function splitExercises(log: WorkoutLog): { shown: SessionExercise[]; skipped: number } {
  const shown = log.exercises.filter((ex) => ex.sets.some((s) => s.done));
  return { shown, skipped: log.exercises.length - shown.length };
}

/** Local calendar date of a log ('YYYY-MM-DD' is local, never parsed as UTC). */
export function formatLogDate(log: Pick<WorkoutLog, 'date'>, locale: Locale, opts?: Intl.DateTimeFormatOptions): string {
  return formatDate(parseLocalDay(log.date), locale, opts ?? { weekday: 'short', day: 'numeric', month: 'short' });
}

export function formatStartTime(iso: string, locale: Locale): string {
  return formatDate(iso, locale, { hour: '2-digit', minute: '2-digit', hour12: false });
}

export interface MonthGroup {
  key: string;
  logs: WorkoutLog[];
}

/** Consecutive logs grouped by 'YYYY-MM' (input is already newest first). */
export function groupByMonth(logs: readonly WorkoutLog[]): MonthGroup[] {
  const groups: MonthGroup[] = [];
  for (const log of logs) {
    const key = log.date.slice(0, 7);
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.logs.push(log);
    else groups.push({ key, logs: [log] });
  }
  return groups;
}

/** Rows shown in a set table: working sets numbered 1..n, warm-ups unnumbered. */
export interface SetRow {
  set: SetEntry;
  /** 1-based working-set number; null for warm-ups. */
  number: number | null;
}

export function setRows(ex: SessionExercise, showUndone: boolean): SetRow[] {
  const rows: SetRow[] = [];
  let n = 0;
  for (const set of ex.sets) {
    const number = set.type === 'warmup' ? null : ++n;
    if (!set.done && !showUndone) continue;
    rows.push({ set, number });
  }
  return rows;
}
