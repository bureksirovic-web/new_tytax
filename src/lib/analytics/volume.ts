import type { WorkoutLog } from '@/contracts/domain';
import { getWeekKey, parseLocalDay } from '@/lib/utils';
import { standardizeMuscle } from '@/lib/constants';
import { countedSets, exerciseVolume, liveLogs, logVolume } from './sets';

export interface VolumeDataPoint {
  weekKey: string;
  totalVolume: number;
  byModality: Record<string, number>;
  byMuscle: Record<string, number>;
  sessionCount: number;
}

/** Weekly (ISO week of the local `date`) volume over done working sets of live logs. */
export function computeWeeklyVolume(logs: readonly WorkoutLog[]): VolumeDataPoint[] {
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
      for (const set of countedSets(ex)) {
        const vol = set.kg * set.reps;
        point.totalVolume += vol;
        const mod = ex.modality ?? 'custom';
        point.byModality[mod] = (point.byModality[mod] ?? 0) + vol;
        for (const impact of ex.muscleImpactSnapshot ?? []) {
          const muscle = standardizeMuscle(impact.muscle);
          point.byMuscle[muscle] = (point.byMuscle[muscle] ?? 0) + vol * (impact.score / 100);
        }
      }
    }
  }

  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, v]) => v);
}

/** Impact-weighted volume per standardised muscle (from each log's snapshot), largest first. */
export function volumeByMuscle(logs: readonly WorkoutLog[]): Record<string, number> {
  const totals: Record<string, number> = {};

  for (const log of liveLogs(logs)) {
    for (const ex of log.exercises) {
      if (!ex.muscleImpactSnapshot) continue;
      const exVol = exerciseVolume(ex);
      for (const impact of ex.muscleImpactSnapshot) {
        const muscle = standardizeMuscle(impact.muscle);
        totals[muscle] = (totals[muscle] ?? 0) + exVol * (impact.score / 100);
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
