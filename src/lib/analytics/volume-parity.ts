import type { WorkoutLog } from '@/types/workout';
import { findExerciseById } from '@/data';

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

export function computeVolumeParity(logs: WorkoutLog[], windowDays = 30): ParityResult[] {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - windowDays);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  const recentLogs = logs.filter(log => log.date >= cutoffStr);

  const volumeByPattern: Record<MovementPattern, number> = {
    push: 0, pull: 0, quad: 0, hinge: 0, carry: 0, core: 0, other: 0
  };

  let totalVolume = 0;

  for (const log of recentLogs) {
    for (const ex of log.exercises) {
      const exerciseDef = findExerciseById(ex.exerciseRef);
      let pattern: MovementPattern = 'other';
      if (exerciseDef && exerciseDef.pattern) {
        const rawPattern = exerciseDef.pattern.toLowerCase();
        // find exact match or partial match
        for (const [key, val] of Object.entries(PATTERN_MAP)) {
          if (rawPattern.includes(key)) {
            pattern = val;
            break;
          }
        }
      }

      const exVolume = ex.sets.reduce((sum, set) => sum + set.kg * set.reps, 0);
      volumeByPattern[pattern] += exVolume;
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
