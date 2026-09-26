import type { WorkoutLog } from '@/contracts/domain';
import type { ExerciseLookup } from '@/contracts/training';
import { dayCutoff, exerciseVolume, liveLogs } from './sets';

export type MovementPattern = 'push' | 'pull' | 'quad' | 'hinge' | 'carry' | 'core' | 'other';

/**
 * Catalog `pattern` → movement pattern. First matching rule wins, so the
 * specific families come first: "Hip Extension" is a hinge and "Knee
 * Extension" a quad move before the generic "extension" (triceps) → push;
 * "Calf Raise" is legs before "raise" → push; "Pushdown" never contains
 * "pull". Patterns are lower-cased with '-', '/', '(' and ')' as spaces.
 */
const PATTERN_RULES: ReadonlyArray<readonly [RegExp, MovementPattern]> = [
  [/\bcarry\b/, 'carry'],
  [/scapular|rear delt|lower trap/, 'pull'],
  [/core|crunch|\brotation\b|\banti\b|trunk|lateral flexion|isometric hold|\btgu\b|windmill|\bchop\b|hip flexion/, 'core'],
  [/leg press|squat|lunge|step up|\bquads?\b|knee extension|calf|plantarflexion/, 'quad'],
  [/hinge|deadlift|\brdl\b|hip extension|hip thrust|glute|bridge|kickback|abduction|knee flexion|hamstring|swing|snatch|\bclean\b/, 'hinge'],
  [/pull|\brow\b|curl|shrug|pullover|shoulder extension/, 'pull'],
  [/press|push|\bdips?\b|\bfly\b|chest|extension|raise|shoulders/, 'push'],
];

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

export function movementOf(pattern: string | undefined): MovementPattern {
  if (!pattern) return 'other';
  const p = pattern.toLowerCase().replace(/[-/()]/g, ' ').replace(/\s+/g, ' ').trim();
  for (const [re, movement] of PATTERN_RULES) if (re.test(p)) return movement;
  return 'other';
}

export function patternOf(exerciseId: string, lookup: ExerciseLookup): MovementPattern {
  return movementOf(lookup(exerciseId)?.pattern);
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
  // No eager catalog here (it would land in first-load JS): without a lookup
  // every exercise counts as 'other'. Callers pass the lazy catalog's lookup.
  const lookup: ExerciseLookup = opts.lookup ?? (() => undefined);
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
