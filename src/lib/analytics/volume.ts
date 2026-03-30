import type { WorkoutLog } from '@/types/workout';
import { getWeekKey } from '@/lib/utils';
import { MUSCLE_NAME_MAP } from '@/lib/constants';

export interface VolumeDataPoint {
  weekKey: string;
  totalVolume: number;
  byModality: Record<string, number>;
  byMuscle: Record<string, number>;
  sessionCount: number;
}

export function computeWeeklyVolume(logs: WorkoutLog[]): VolumeDataPoint[] {
  const map = new Map<string, VolumeDataPoint>();

  for (const log of logs) {
    const wk = getWeekKey(new Date(log.date));
    if (!map.has(wk)) {
      map.set(wk, { weekKey: wk, totalVolume: 0, byModality: {}, byMuscle: {}, sessionCount: 0 });
    }
    const point = map.get(wk)!;
    point.sessionCount += 1;

    for (const ex of log.exercises) {
      for (const set of ex.sets) {
        const vol = set.kg * set.reps;
        point.totalVolume += vol;

        const mod = ex.modality ?? 'custom';
        point.byModality[mod] = (point.byModality[mod] ?? 0) + vol;

        if (ex.muscleImpactSnapshot) {
          for (const impact of ex.muscleImpactSnapshot) {
            const muscle = MUSCLE_NAME_MAP[impact.muscle] ?? impact.muscle;
            const share = vol * (impact.score / 100);
            point.byMuscle[muscle] = (point.byMuscle[muscle] ?? 0) + share;
          }
        }
      }
    }
  }

  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, v]) => v);
}

export function volumeByMuscle(logs: WorkoutLog[]): Record<string, number> {
  const totals: Record<string, number> = {};

  for (const log of logs) {
    for (const ex of log.exercises) {
      if (!ex.muscleImpactSnapshot) continue;
      const exVol = ex.sets.reduce((s, set) => s + set.kg * set.reps, 0);
      for (const impact of ex.muscleImpactSnapshot) {
        const muscle = MUSCLE_NAME_MAP[impact.muscle] ?? impact.muscle;
        totals[muscle] = (totals[muscle] ?? 0) + exVol * (impact.score / 100);
      }
    }
  }

  return Object.fromEntries(
    Object.entries(totals).sort(([, a], [, b]) => b - a)
  );
}

export function computeMonthlyTrend(logs: WorkoutLog[]): { month: string; volume: number }[] {
  const map = new Map<string, number>();

  for (const log of logs) {
    const month = log.date.slice(0, 7);
    const vol = log.exercises.reduce(
      (s, ex) => s + ex.sets.reduce((ss, set) => ss + set.kg * set.reps, 0),
      0
    );
    map.set(month, (map.get(month) ?? 0) + vol);
  }

  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, volume]) => ({ month, volume }));
}
