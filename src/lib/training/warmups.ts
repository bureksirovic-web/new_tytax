import type { SetEntry, WarmupStrategy } from '@/contracts/domain';
import type { GenerateWarmupsFn, WarmupOptions } from '@/contracts/training';
import { newId, roundTo } from './common';

export interface WarmupStep {
  /** Fraction of the working weight. */
  pct: number;
  reps: number;
}

/**
 * Warm-up ladders, ported from the original app (tytax-autonomous
 * `index.html` `generateWarmups`): Standard 50%×10, 75%×5; Heavy adds
 * 85%×3 and 95%×1 (potentiation); Pyramid 40%×12, 60%×8, 80%×4.
 */
export const WARMUP_LADDERS: Readonly<Record<Exclude<WarmupStrategy, 'none'>, readonly WarmupStep[]>> = Object.freeze({
  standard: [
    { pct: 0.5, reps: 10 },
    { pct: 0.75, reps: 5 },
  ],
  heavy: [
    { pct: 0.5, reps: 10 },
    { pct: 0.75, reps: 5 },
    { pct: 0.85, reps: 3 },
    { pct: 0.95, reps: 1 },
  ],
  pyramid: [
    { pct: 0.4, reps: 12 },
    { pct: 0.6, reps: 8 },
    { pct: 0.8, reps: 4 },
  ],
});

export interface PlannedWarmup {
  pct: number;
  reps: number;
  kg: number;
}

/**
 * The warm-up ladder for a working weight. Each step is rounded to
 * `roundToKg` (default 2.5) and never goes below `barKg` (default 20). A step
 * whose rounded weight equals the previous kept step's, or reaches the
 * working weight, is dropped. Working weight ≤ bar, or `none` → [].
 */
export function planWarmups(workingKg: number, strategy: WarmupStrategy, opts?: WarmupOptions): PlannedWarmup[] {
  const barKg = opts?.barKg ?? 20;
  const inc = opts?.roundToKg ?? 2.5;
  if (strategy === 'none' || !(workingKg > barKg)) return [];
  const ladder = WARMUP_LADDERS[strategy];
  if (!ladder) return [];
  const out: PlannedWarmup[] = [];
  let prevKg: number | undefined;
  for (const step of ladder) {
    const kg = Math.max(barKg, roundTo(workingKg * step.pct, inc));
    if (kg >= workingKg || kg === prevKg) continue;
    out.push({ pct: step.pct, reps: step.reps, kg });
    prevKg = kg;
  }
  return out;
}

/** Warm-up sets (`type: 'warmup'`, `done: false`, uuid ids) from `planWarmups`. */
export const generateWarmups: GenerateWarmupsFn = (workingKg, strategy, opts) =>
  planWarmups(workingKg, strategy, opts).map(
    (w): SetEntry => ({ id: newId(), type: 'warmup', kg: w.kg, reps: w.reps, done: false }),
  );
