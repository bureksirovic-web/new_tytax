import type { E1rmFn } from '@/contracts/training';

/**
 * Estimated one-rep max in kg: Brzycki `kg × 36 / (37 − reps)` for 2–36
 * reps, Epley `kg × (1 + reps / 30)` from 37 reps (Brzycki's denominator hits
 * zero at 37). reps ≤ 0 or kg ≤ 0 → 0; 1 rep → kg.
 */
export const e1rm: E1rmFn = (kg, reps) => {
  if (!(kg > 0) || !(reps > 0)) return 0;
  if (reps === 1) return kg;
  // kg × (30 + reps) / 30 is Epley's kg × (1 + reps / 30) with less float noise.
  if (reps >= 37) return (kg * (30 + reps)) / 30;
  return (kg * 36) / (37 - reps);
};
