import type { WarmupSet } from '@/types/analytics';

/**
 * Brzycki e1RM formula: weight / (1.0278 - 0.0278 * reps)
 * Reliable for 1-36 reps.
 */
export function brzycki(weight: number, reps: number): number {
  if (reps === 1) return weight;
  if (reps > 36) reps = 36;
  return weight / (1.0278 - 0.0278 * reps);
}

/**
 * Round weight to nearest multiple of 2.5.
 */
function roundTo2_5(value: number): number {
  return Math.round(value / 2.5) * 2.5;
}

/**
 * Standard warmup progression for a given working weight.
 * Returns: 40%x8, 60%x5, 80%x3, 90%x1
 */
export function getWarmupSets(
  workingWeight: number,
  unit: 'kg' | 'lb' = 'kg'
): WarmupSet[] {
  const percents: Array<{ percent: number; reps: number; label: string }> = [
    { percent: 0.4, reps: 8, label: 'Primer' },
    { percent: 0.6, reps: 5, label: 'Activation' },
    { percent: 0.8, reps: 3, label: 'Potentiation' },
    { percent: 0.9, reps: 1, label: 'Ramp' },
  ];

  return percents.map(({ percent, reps, label }) => ({
    percent: percent * 100,
    reps,
    weight: roundTo2_5(workingWeight * percent),
    label: `${label} — ${Math.round(percent * 100)}% × ${reps} ${unit}`,
  }));
}

/**
 * Total volume load across a set of logged work.
 */
export function volumeLoad(sets: Array<{ weight: number; reps: number }>): number {
  return sets.reduce((sum, s) => sum + s.weight * s.reps, 0);
}
