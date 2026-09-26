import type { WarmupSet, WarmupStrategy } from '@/contracts/domain';
import type { WarmupOptions } from '@/contracts/training';
import { e1rm, planWarmups } from '@/lib/training';

/**
 * Estimated 1RM. Delegates to the training engine (`training.e1rm`):
 * Brzycki `kg × 36 / (37 − reps)` up to 36 reps, Epley from 37.
 */
export function brzycki(weight: number, reps: number): number {
  return e1rm(weight, reps);
}

/**
 * Warm-up ladder for the warm-up calculator, from the training engine
 * (`planWarmups`, same rules as `training.generateWarmups`). `unit` only
 * changes the label; weights are in the unit passed in.
 */
export function getWarmupSets(
  workingWeight: number,
  unit: 'kg' | 'lb' = 'kg',
  strategy: WarmupStrategy = 'standard',
  opts?: WarmupOptions,
): WarmupSet[] {
  return planWarmups(workingWeight, strategy, opts).map((w) => {
    const percent = Math.round(w.pct * 1000) / 10;
    return {
      percent,
      reps: w.reps,
      weight: w.kg,
      label: `${percent}% × ${w.reps} ${unit}`,
    };
  });
}

/**
 * Total volume load across a set of logged work.
 */
export function volumeLoad(sets: Array<{ weight: number; reps: number }>): number {
  return sets.reduce((sum, s) => sum + s.weight * s.reps, 0);
}
