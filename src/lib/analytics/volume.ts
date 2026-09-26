import type { WorkoutLog } from '@/contracts/domain';
import type { ExerciseLookup } from '@/contracts/training';
import { getWeekKey, parseLocalDay } from '@/lib/utils';
import { impactWeights, isTimeSet } from '@/lib/training/common';
import { countedSets, exerciseVolume, liveLogs, logVolume, setVolume } from './sets';

export interface VolumeDataPoint {
  weekKey: string;
  totalVolume: number;
  byModality: Record<string, number>;
  byMuscle: Record<string, number>;
  sessionCount: number;
}

const noLookup: ExerciseLookup = () => undefined;

/**
 * Weekly (ISO week of the local `date`) kg × reps volume over done working
 * sets of live logs (time sets add none). Muscle shares use the catalog impact (`lookup`), falling back to the
 * log's `muscleImpactSnapshot`.
 */
export function computeWeeklyVolume(logs: readonly WorkoutLog[], opts: { lookup?: ExerciseLookup } = {}): VolumeDataPoint[] {
  const lookup = opts.lookup ?? noLookup;
  const map = new Map<string, VolumeDataPoint>();

  for (const log of liveLogs(logs)) {
    const wk = getWeekKey(parseLocalDay(log.date));
    let point = map.get(wk);
    if (!point) {
      point = { weekKey: wk, totalVolume: 0, byModality: {}, byMuscle: {}, sessionCount: 0 };
      map.set(wk, point);
    }
    point.sessionCount += 1;

    for (const ex of log.exercises) {
      const weights = impactWeights(ex, lookup);
      for (const set of countedSets(ex)) {
        // Time sets are counted sets but carry no kg × reps volume.
        if (isTimeSet(set)) continue;
        const vol = setVolume(set);
        point.totalVolume += vol;
        const mod = ex.modality ?? 'custom';
        point.byModality[mod] = (point.byModality[mod] ?? 0) + vol;
        for (const [muscle, weight] of weights) {
          point.byMuscle[muscle] = (point.byMuscle[muscle] ?? 0) + vol * weight;
        }
      }
    }
  }

  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, v]) => v);
}

/**
 * Impact-weighted volume per standardised muscle, largest first. Impact from
 * the catalog (`lookup`), falling back to each log's snapshot.
 */
export function volumeByMuscle(logs: readonly WorkoutLog[], opts: { lookup?: ExerciseLookup } = {}): Record<string, number> {
  const lookup = opts.lookup ?? noLookup;
  const totals: Record<string, number> = {};

  for (const log of liveLogs(logs)) {
    for (const ex of log.exercises) {
      const exVol = exerciseVolume(ex);
      if (exVol <= 0) continue;
      for (const [muscle, weight] of impactWeights(ex, lookup)) {
        totals[muscle] = (totals[muscle] ?? 0) + exVol * weight;
      }
    }
  }

  return Object.fromEntries(Object.entries(totals).sort(([, a], [, b]) => b - a));
}

/** Volume per calendar month ('YYYY-MM'). */
export function computeMonthlyTrend(logs: readonly WorkoutLog[]): { month: string; volume: number }[] {
  const map = new Map<string, number>();

  for (const log of liveLogs(logs)) {
    const month = log.date.slice(0, 7);
    map.set(month, (map.get(month) ?? 0) + logVolume(log));
  }

  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, volume]) => ({ month, volume }));
}
