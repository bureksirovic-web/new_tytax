import type { WorkoutLog } from '@/types/workout';
import { MUSCLE_NAME_MAP } from '@/lib/constants';

export interface MuscleGapResult {
  muscle: string;
  volume: number;
  percentageOfTotal: number;
  lastTrained: string | null;
  status: 'neglected' | 'undertrained' | 'balanced' | 'overtrained';
}

function getMuscleStatus(pct: number): MuscleGapResult['status'] {
  if (pct < 2) return 'neglected';
  if (pct < 5) return 'undertrained';
  if (pct > 25) return 'overtrained';
  return 'balanced';
}

export function analyzeMuscleGaps(logs: WorkoutLog[], windowDays = 30): MuscleGapResult[] {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - windowDays);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  const windowed = logs.filter((l) => l.date >= cutoffStr);

  const volumeByMuscle = new Map<string, number>();
  const lastTrainedByMuscle = new Map<string, string>();

  for (const log of windowed) {
    for (const ex of log.exercises) {
      if (!ex.muscleImpactSnapshot) continue;
      const exVol = ex.sets.reduce((s, set) => s + set.kg * set.reps, 0);
      for (const impact of ex.muscleImpactSnapshot) {
        const muscle = MUSCLE_NAME_MAP[impact.muscle] ?? impact.muscle;
        const share = exVol * (impact.score / 100);
        volumeByMuscle.set(muscle, (volumeByMuscle.get(muscle) ?? 0) + share);
        const prev = lastTrainedByMuscle.get(muscle);
        if (!prev || log.date > prev) {
          lastTrainedByMuscle.set(muscle, log.date);
        }
      }
    }
  }

  const totalVolume = Array.from(volumeByMuscle.values()).reduce((s, v) => s + v, 0);

  return Array.from(volumeByMuscle.entries())
    .map(([muscle, volume]) => {
      const percentageOfTotal = totalVolume > 0 ? (volume / totalVolume) * 100 : 0;
      return {
        muscle,
        volume,
        percentageOfTotal,
        lastTrained: lastTrainedByMuscle.get(muscle) ?? null,
        status: getMuscleStatus(percentageOfTotal),
      };
    })
    .sort((a, b) => b.volume - a.volume);
}
