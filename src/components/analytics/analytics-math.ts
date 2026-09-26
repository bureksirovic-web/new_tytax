/**
 * Pure analytics derivations for the analytics screen. Training maths (impact,
 * lagging muscle, ACWR, e1RM, what counts as a set) comes from `training`;
 * this file only windows, groups and labels. Logs are any order; soft-deleted
 * logs and non-counting sets (warm-ups, undone) are always ignored.
 */
import type { SetEntry, WorkoutLog } from '@/contracts/domain';
import type { ExerciseLookup, LaggingResult } from '@/contracts/training';
import { ACWR_FRESH_BELOW, ACWR_FRIED_ABOVE, isDoneWorkingSet, training } from '@/lib/training';
import { daysBetween, localDay, logTimeMs, mondayOf, shiftDay } from './analytics-dates';
import { isTimeSetG1 } from './g1-adapters';
import { muscleVolumeKg } from './muscle-volume';

export function liveLogs(logs: readonly WorkoutLog[]): WorkoutLog[] {
  return logs.filter((l) => !l.deletedAt);
}

/** Newest first by end time. */
export function newestFirst(logs: readonly WorkoutLog[]): WorkoutLog[] {
  return [...logs].sort((a, b) => logTimeMs(b) - logTimeMs(a) || b.date.localeCompare(a.date));
}

/**
 * A done working set measured in kg × reps. Time-measured sets (holds, carries,
 * stretches: G1's `isTimeSet`, locally `durationSeconds` recorded) never enter
 * e1RM or kg volume.
 */
export function isKgSet(s: SetEntry): boolean {
  return isDoneWorkingSet(s) && !isTimeSetG1(s);
}

/** Σ kg × reps over done working kg sets. */
export function logVolumeKg(log: WorkoutLog): number {
  let v = 0;
  for (const ex of log.exercises) for (const s of ex.sets) if (isKgSet(s)) v += s.kg * s.reps;
  return v;
}

// ─── Muscle distribution ─────────────────────────────────────────────────────

export type DistributionWindow = '7d' | '30d' | '20s';
export const DISTRIBUTION_WINDOWS: readonly DistributionWindow[] = ['20s', '7d', '30d'];

export interface MuscleShare {
  muscle: string;
  share: number;
  /** Impact-weighted kg volume of the same window (0 when only time-measured sets hit it). */
  volumeKg: number;
}

export interface DistributionResult {
  shares: MuscleShare[];
  lagging: LaggingResult | null;
}

/** '7d'/'30d' = live logs whose local day is within the last 7/30 days including today; '20s' = the 20 newest. */
export function windowLogs(logs: readonly WorkoutLog[], window: DistributionWindow, now: Date): WorkoutLog[] {
  const live = liveLogs(logs);
  if (window === '20s') return newestFirst(live).slice(0, 20);
  const today = localDay(now);
  const from = shiftDay(today, -((window === '7d' ? 7 : 30) - 1));
  return live.filter((l) => l.date >= from && l.date <= today);
}

/**
 * Impact share per muscle (set-based stimulus, `training.impactDistribution`)
 * plus its kg volume (`muscleVolumeKg`), both over `windowLogs` with the
 * catalog lookup, so program logs without a snapshot count too.
 */
export function muscleDistribution(
  logs: readonly WorkoutLog[],
  lookup: ExerciseLookup,
  window: DistributionWindow,
  now: Date,
): DistributionResult {
  const inWindow = windowLogs(logs, window, now);
  const dist = training.impactDistribution(inWindow, lookup);
  const volume = muscleVolumeKg(inWindow, lookup);
  const shares = Object.entries(dist)
    .map(([muscle, share]) => ({ muscle, share, volumeKg: volume[muscle] ?? 0 }))
    .sort((a, b) => b.share - a.share || a.muscle.localeCompare(b.muscle));
  return { shares, lagging: training.laggingMuscle(dist) };
}

// ─── ACWR ────────────────────────────────────────────────────────────────────

export type AcwrZone = 'undertrain' | 'optimal' | 'caution' | 'danger';
/** Upper edge of the Gabbett sweet spot; 1.3–1.5 is shown as caution before `fried`. */
export const ACWR_CAUTION_ABOVE = 1.3;
export const ACWR_BASELINE_DAYS = 28;

export function acwrZone(ratio: number): AcwrZone {
  if (ratio > ACWR_FRIED_ABOVE) return 'danger';
  if (ratio > ACWR_CAUTION_ABOVE) return 'caution';
  if (ratio < ACWR_FRESH_BELOW) return 'undertrain';
  return 'optimal';
}

export interface AcwrRow {
  muscle: string;
  acute: number;
  chronic: number;
  ratio: number;
  zone: AcwrZone;
}

export interface AcwrSummary {
  rows: AcwrRow[];
  /** Days from the first live log to today (0 when there is none). */
  daysOfHistory: number;
  /** Fewer than 28 days of history: the chronic load is not real yet, so no zones. */
  building: boolean;
}

export function acwrSummary(logs: readonly WorkoutLog[], lookup: ExerciseLookup, now: Date): AcwrSummary {
  const live = liveLogs(logs);
  const today = localDay(now);
  const first = live.reduce<string | null>((min, l) => (min === null || l.date < min ? l.date : min), null);
  const daysOfHistory = first ? Math.max(0, daysBetween(first, today)) : 0;
  const rows = training.acwr(live, lookup, now).map((r) => ({
    muscle: r.muscle,
    acute: r.acuteLoad,
    chronic: r.chronicLoad,
    ratio: r.ratio,
    zone: acwrZone(r.ratio),
  }));
  return { rows, daysOfHistory, building: daysOfHistory < ACWR_BASELINE_DAYS };
}

// ─── Heatmap and weekly volume ───────────────────────────────────────────────

export interface HeatDay {
  day: string;
  sessions: number;
  volumeKg: number;
  future: boolean;
}

/** `weeks` Monday-first weeks ending with the current week, oldest first. */
export function heatmapWeeks(logs: readonly WorkoutLog[], now: Date, weeks = 12): HeatDay[][] {
  const today = localDay(now);
  const start = shiftDay(mondayOf(today), -7 * (weeks - 1));
  const byDay = new Map<string, { sessions: number; volumeKg: number }>();
  for (const log of liveLogs(logs)) {
    if (log.date < start || log.date > today) continue;
    const cell = byDay.get(log.date) ?? { sessions: 0, volumeKg: 0 };
    cell.sessions += 1;
    cell.volumeKg += logVolumeKg(log);
    byDay.set(log.date, cell);
  }
  const out: HeatDay[][] = [];
  for (let w = 0; w < weeks; w += 1) {
    const week: HeatDay[] = [];
    for (let d = 0; d < 7; d += 1) {
      const day = shiftDay(start, w * 7 + d);
      const cell = byDay.get(day);
      week.push({ day, sessions: cell?.sessions ?? 0, volumeKg: cell?.volumeKg ?? 0, future: day > today });
    }
    out.push(week);
  }
  return out;
}

/** 0 = rest, 1–4 = quartile of the day's volume against the busiest day. */
export function heatLevel(volumeKg: number, sessions: number, maxVolumeKg: number): 0 | 1 | 2 | 3 | 4 {
  if (sessions === 0) return 0;
  if (!(maxVolumeKg > 0)) return 1;
  return Math.min(4, Math.max(1, Math.ceil((volumeKg / maxVolumeKg) * 4))) as 1 | 2 | 3 | 4;
}

export interface WeekVolume {
  weekStart: string;
  volumeKg: number;
}

/** Volume of the last `weeks` Monday-first weeks (empty weeks as 0), oldest first. */
export function weeklyVolume(logs: readonly WorkoutLog[], now: Date, weeks = 8): WeekVolume[] {
  const current = mondayOf(localDay(now));
  const out: WeekVolume[] = [];
  for (let i = weeks - 1; i >= 0; i -= 1) out.push({ weekStart: shiftDay(current, -7 * i), volumeKg: 0 });
  const index = new Map(out.map((w, i) => [w.weekStart, i]));
  for (const log of liveLogs(logs)) {
    const i = index.get(mondayOf(log.date));
    if (i !== undefined && log.date <= localDay(now)) out[i].volumeKg += logVolumeKg(log);
  }
  return out;
}
