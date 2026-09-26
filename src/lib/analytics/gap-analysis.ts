import type { WorkoutLog } from '@/contracts/domain';
import { standardizeMuscle } from '@/lib/constants';
import { dayCutoff, exerciseVolume, liveLogs } from './sets';

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

/**
 * Impact-weighted volume share per standardised muscle over the last
 * `windowDays` local calendar days (done working sets of live logs).
 */
export function analyzeMuscleGaps(
  logs: readonly WorkoutLog[],
  windowDays = 30,
  opts: { now?: Date } = {},
): MuscleGapResult[] {
  const cutoffStr = dayCutoff(opts.now ?? new Date(), windowDays);
  const windowed = liveLogs(logs).filter((l) => l.date >= cutoffStr);

  const volumeByMuscle = new Map<string, number>();
  const lastTrainedByMuscle = new Map<string, string>();

  for (const log of windowed) {
    for (const ex of log.exercises) {
      if (!ex.muscleImpactSnapshot) continue;
      const exVol = exerciseVolume(ex);
      if (exVol <= 0) continue;
      for (const impact of ex.muscleImpactSnapshot) {
        const muscle = standardizeMuscle(impact.muscle);
        const share = exVol * (impact.score / 100);
        volumeByMuscle.set(muscle, (volumeByMuscle.get(muscle) ?? 0) + share);
        const prev = lastTrainedByMuscle.get(muscle);
        if (!prev || log.date > prev) lastTrainedByMuscle.set(muscle, log.date);
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
