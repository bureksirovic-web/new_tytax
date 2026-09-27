/**
 * ACWR (acute:chronic workload ratio) for the analytics screen, on top of
 * `training.acwr`. Two guards keep the zone badge honest:
 *   - day-stable clock: the library windows are rolling 24 h blocks ending at
 *     `now`; passing the end of the local day makes acute = the last 7 local
 *     days and chronic = the last 28, so the zone only moves when training
 *     does (never between 18:30 and 20:05 of the same evening);
 *   - per-muscle baseline: a muscle first trained < 28 days ago has no real
 *     chronic load yet, so its row is `building` and shows no ratio or zone,
 *     even when the profile as a whole has a long history.
 */
import type { WorkoutLog } from '@/contracts/domain';
import type { ExerciseLookup } from '@/contracts/training';
import { ACWR_FRESH_BELOW, ACWR_FRIED_ABOVE, training } from '@/lib/training';
import { daysBetween, localDay } from './analytics-dates';

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
  /** Days from the muscle's first trained local day to today. */
  baselineDays: number;
  /** The muscle's own history is under 28 days: ratio and zone are not real yet. */
  building: boolean;
}

export interface AcwrSummary {
  rows: AcwrRow[];
  /** Days from the first live log to today (0 when there is none). */
  daysOfHistory: number;
  /** Fewer than 28 days of history: the chronic load is not real yet, so no zones. */
  building: boolean;
}

/** Last millisecond of `now`'s local calendar day: the ACWR clock for the whole day. */
export function endOfLocalDay(now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
}

/** First local day on which each muscle received load (done working sets), up to `today`. */
export function firstTrainedDay(logs: readonly WorkoutLog[], lookup: ExerciseLookup, today: string): Map<string, string> {
  const first = new Map<string, string>();
  for (const log of logs) {
    if (log.deletedAt || log.date > today) continue;
    for (const [muscle, share] of Object.entries(training.impactDistribution([log], lookup))) {
      if (!(share > 0)) continue;
      const cur = first.get(muscle);
      if (cur === undefined || log.date < cur) first.set(muscle, log.date);
    }
  }
  return first;
}

export function acwrSummary(logs: readonly WorkoutLog[], lookup: ExerciseLookup, now: Date): AcwrSummary {
  const live = logs.filter((l) => !l.deletedAt);
  const today = localDay(now);
  const first = live.reduce<string | null>((min, l) => (min === null || l.date < min ? l.date : min), null);
  const daysOfHistory = first ? Math.max(0, daysBetween(first, today)) : 0;
  const firstByMuscle = firstTrainedDay(live, lookup, today);
  const rows = training.acwr(live, lookup, endOfLocalDay(now)).map((r) => {
    const since = firstByMuscle.get(r.muscle);
    const baselineDays = since ? Math.max(0, daysBetween(since, today)) : 0;
    return {
      muscle: r.muscle,
      acute: r.acuteLoad,
      chronic: r.chronicLoad,
      ratio: r.ratio,
      zone: acwrZone(r.ratio),
      baselineDays,
      building: baselineDays < ACWR_BASELINE_DAYS,
    };
  });
  return { rows, daysOfHistory, building: daysOfHistory < ACWR_BASELINE_DAYS };
}
