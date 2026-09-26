import type { WorkoutLog } from '@/contracts/domain';
import type { ExerciseLookup } from '@/contracts/training';
// Eager catalog, kept only as the default lookup for callers that pass none
// (the analytics page today). Pass a lazy-catalog lookup instead.
import { findExerciseById } from '@/data';
import { dayCutoff, exerciseVolume, liveLogs } from './sets';

export type MovementPattern = 'push' | 'pull' | 'quad' | 'hinge' | 'carry' | 'core' | 'other';

// Map exercise patterns to movement patterns
const PATTERN_MAP: Record<string, MovementPattern> = {
  'horizontal push': 'push',
  'vertical push': 'push',
  'horizontal pull': 'pull',
  'vertical pull': 'pull',
  'squat': 'quad',
  'lunge': 'quad',
  'hinge': 'hinge',
  'deadlift': 'hinge',
  'swing': 'hinge',
  'snatch': 'hinge',
  'carry': 'carry',
  'core': 'core',
  'tgu': 'core',
  'windmill': 'core',
};

export interface ParityResult {
  pattern: MovementPattern;
  volume: number;
  percentage: number;
  targetPercentage: number; // ideal balance
  delta: number; // actual - target (positive = overtrained, negative = undertrained)
  status: 'balanced' | 'overtrained' | 'undertrained';
}

// Target percentages for balanced training
const TARGETS: Record<MovementPattern, number> = {
  push: 20, pull: 20, quad: 20, hinge: 20, carry: 5, core: 10, other: 5
};

export function getParityLabel(delta: number): 'balanced' | 'overtrained' | 'undertrained' {
  if (Math.abs(delta) <= 5) return 'balanced';
  if (delta > 0) return 'overtrained';
  return 'undertrained';
}

export function patternOf(exerciseId: string, lookup: ExerciseLookup): MovementPattern {
  const raw = lookup(exerciseId)?.pattern?.toLowerCase();
  if (!raw) return 'other';
  for (const [key, val] of Object.entries(PATTERN_MAP)) {
    if (raw.includes(key)) return val;
  }
  return 'other';
}

/**
 * Volume share per movement pattern over the last `windowDays` local days
 * (done working sets of live logs) against the balanced targets.
 */
export function computeVolumeParity(
  logs: readonly WorkoutLog[],
  windowDays = 30,
  opts: { now?: Date; lookup?: ExerciseLookup } = {},
): ParityResult[] {
  const cutoffStr = dayCutoff(opts.now ?? new Date(), windowDays);
  const lookup = opts.lookup ?? findExerciseById;
  const recentLogs = liveLogs(logs).filter((log) => log.date >= cutoffStr);

  const volumeByPattern: Record<MovementPattern, number> = {
    push: 0, pull: 0, quad: 0, hinge: 0, carry: 0, core: 0, other: 0
  };

  let totalVolume = 0;

  for (const log of recentLogs) {
    for (const ex of log.exercises) {
      const exVolume = exerciseVolume(ex);
      volumeByPattern[patternOf(ex.exerciseId, lookup)] += exVolume;
      totalVolume += exVolume;
    }
  }

  const results: ParityResult[] = [];

  for (const p of Object.keys(TARGETS) as MovementPattern[]) {
    const vol = volumeByPattern[p];
    const percentage = totalVolume > 0 ? (vol / totalVolume) * 100 : 0;
    const target = TARGETS[p];
    const delta = percentage - target;
    results.push({
      pattern: p,
      volume: vol,
      percentage,
      targetPercentage: target,
      delta,
      status: getParityLabel(delta)
    });
  }

  return results.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
}
