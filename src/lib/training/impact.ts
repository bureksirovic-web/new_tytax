import type { ImpactDistributionFn, LaggingMuscleFn, LaggingResult } from '@/contracts/training';
import { addLogLoad, clean, liveLogs } from './common';

/**
 * Default target share of training stimulus per standardised muscle (names
 * from `MUSCLE_GROUPS` in src/lib/constants.ts). A balanced full-body
 * hypertrophy split: big movers (chest, lats, quads) get the most, then
 * posterior chain and arms, then the small stabilising groups. Sums to 1.
 *
 *   Chest .12 · Lats .10 · Rhomboids .05 · Mid/Lower Traps .05 · Upper Traps .03
 *   Front Delts .04 · Side Delts .06 · Rear Delts .04
 *   Biceps .06 · Triceps .07 · Forearms .02
 *   Quads .12 · Hamstrings .08 · Glutes .08 · Calves .04 · Core .04
 */
export const IDEAL_DISTRIBUTION: Readonly<Record<string, number>> = Object.freeze({
  Chest: 0.12,
  Lats: 0.1,
  Rhomboids: 0.05,
  'Mid/Lower Traps': 0.05,
  'Upper Traps': 0.03,
  'Front Delts': 0.04,
  'Side Delts': 0.06,
  'Rear Delts': 0.04,
  Biceps: 0.06,
  Triceps: 0.07,
  Forearms: 0.02,
  Quads: 0.12,
  Hamstrings: 0.08,
  Glutes: 0.08,
  Calves: 0.04,
  Core: 0.04,
});

/**
 * Share of stimulus per standardised muscle over done working sets of
 * non-deleted logs whose `date` is within the inclusive range. Each set adds
 * score/100 for every muscle it hits (catalog impact, falling back to the
 * log's snapshot); shares are normalised to sum to 1. No load → {}.
 */
export const impactDistribution: ImpactDistributionFn = (logs, lookup, range) => {
  const load = new Map<string, number>();
  for (const log of liveLogs(logs)) {
    if (range?.from && log.date < range.from) continue;
    if (range?.to && log.date > range.to) continue;
    addLogLoad(log, lookup, load);
  }
  let total = 0;
  for (const v of load.values()) total += v;
  if (!(total > 0)) return {};
  const out: Record<string, number> = {};
  for (const [muscle, v] of load) out[muscle] = v / total;
  return out;
};

/**
 * The target muscle with the largest positive gap (target − actual share),
 * or null when nothing is under target or the distribution is empty (no
 * training yet means nothing is "lagging"). Ties keep the first target in
 * insertion order.
 */
export const laggingMuscle: LaggingMuscleFn = (distribution, targets = IDEAL_DISTRIBUTION) => {
  const trained = Object.values(distribution).some((v) => v > 0);
  if (!trained) return null;
  let best: LaggingResult | null = null;
  for (const [muscle, targetShare] of Object.entries(targets)) {
    const actualShare = Object.prototype.hasOwnProperty.call(distribution, muscle) ? distribution[muscle] : 0;
    const gap = clean(targetShare - actualShare);
    if (gap > 0 && (best === null || gap > best.gap)) {
      best = { muscle, actualShare, targetShare, gap };
    }
  }
  return best;
};
