/**
 * Training engine (implements `TrainingApi` from src/contracts/training.ts).
 * Pure functions; the clock is always passed in as `now`.
 */
import type { TrainingApi } from '@/contracts/training';
import { acwr } from './acwr';
import { deload } from './deload';
import { e1rm } from './e1rm';
import { impactDistribution, laggingMuscle } from './impact';
import { prefillFromHistory } from './prefill';
import { detectPRs } from './prs';
import { recoveryStatus } from './recovery';
import { generateWarmups } from './warmups';

export { isDoneWorkingSet, roundTo } from './common';
export { e1rm } from './e1rm';
export { generateWarmups, planWarmups, WARMUP_LADDERS } from './warmups';
export type { PlannedWarmup, WarmupStep } from './warmups';
export { prefillFromHistory, PREFILL_INCREMENT_KG } from './prefill';
export { detectPRs, E1RM_MAX_REPS, E1RM_PR_MAX_REPS } from './prs';
export { impactDistribution, laggingMuscle, IDEAL_DISTRIBUTION } from './impact';
export { recoveryStatus, RECOVERY_WINDOW_HOURS, RECOVERY_FRIED_LOAD } from './recovery';
export { acwr, historyWeeks, ACWR_FRIED_ABOVE, ACWR_FRESH_BELOW, ACWR_TREND_BAND } from './acwr';
export { deload, DELOAD_FACTOR } from './deload';

export const training: TrainingApi = {
  e1rm,
  generateWarmups,
  prefillFromHistory,
  detectPRs,
  impactDistribution,
  laggingMuscle,
  recoveryStatus,
  acwr,
  deload,
};
