/**
 * Movement-pattern balance: volume share per pattern over done working sets
 * of live logs, against a balanced target. The catalog's `pattern` strings
 * are free text ('Leg Press', 'Hip Extension', 'Cable Fly', 'Quads' …), so
 * they are classified by ordered rules (first match wins) and anything left
 * falls back to the exercise's `muscleGroup`.
 */
import type { MuscleGroup, WorkoutLog } from '@/contracts/domain';
import type { ExerciseLookup } from '@/contracts/training';
import { isDoneWorkingSet } from '@/lib/training';
import { liveLogs } from './analytics-math';

export type MovementPattern = 'push' | 'pull' | 'quad' | 'hinge' | 'carry' | 'core' | 'other';

/** Ordered: leg/hip rules run before the generic 'press'/'extension'/'raise' push words. */
const PATTERN_RULES: ReadonlyArray<[RegExp, MovementPattern]> = [
  [/carry/, 'carry'],
  [/wrist|grip|pronation|supination|calf/, 'other'],
  [/hinge|deadlift|rdl|swing|snatch|good ?morning|hip extension|hip thrust|glute bridge|hamstring|knee flexion/, 'hinge'],
  [/squat|lunge|step-up|leg press|quad|knee extension/, 'quad'],
  [/scapular|shoulder extension|pullover/, 'pull'],
  [/core|crunch|rotation|anti-|trunk|lateral flexion|tgu|windmill|brace/, 'core'],
  [/pull|row|curl|shrug|rear delt|scapular|trap|elbow flexion/, 'pull'],
  [/push|press|dip|fly|chest|shoulder|raise|elbow extension|overhead extension|^extension$/, 'push'],
];

const GROUP_PATTERN: Readonly<Record<MuscleGroup, MovementPattern>> = {
  CHEST: 'push', SHOULDERS: 'push', TRICEPS: 'push',
  BACK_VERTICAL: 'pull', BACK_HORIZONTAL: 'pull', BICEPS: 'pull',
  QUADS: 'quad', HAMSTRINGS: 'hinge', GLUTES: 'hinge',
  CORE: 'core', CALVES: 'other', FOREARMS_GRIP: 'other',
};

/** Balanced-training target share per pattern, percent (sums to 100). */
export const PATTERN_TARGETS: Readonly<Record<MovementPattern, number>> = { push: 20, pull: 20, quad: 20, hinge: 20, carry: 5, core: 10, other: 5 };

/** ±percentage points around the target that still count as on target. */
const TOLERANCE = 5;

export function patternOf(exerciseId: string, lookup: ExerciseLookup): MovementPattern {
  const ex = lookup(exerciseId);
  if (!ex) return 'other';
  const raw = (ex.pattern ?? '').toLowerCase().trim();
  const rule = PATTERN_RULES.find(([re]) => re.test(raw));
  if (rule) return rule[1];
  return GROUP_PATTERN[ex.muscleGroup] ?? 'other';
}

export interface ParityRow {
  pattern: MovementPattern;
  pct: number;
  target: number;
  onTarget: boolean;
}

/**
 * Volume share per movement pattern for logs on or after `fromDay`; [] without
 * volume. A pattern with no volume is never on target, whatever its tolerance.
 */
export function movementParity(logs: readonly WorkoutLog[], lookup: ExerciseLookup, fromDay: string): ParityRow[] {
  const vol = new Map<MovementPattern, number>();
  let total = 0;
  for (const log of liveLogs(logs)) {
    if (log.date < fromDay) continue;
    for (const ex of log.exercises) {
      const v = ex.sets.filter(isDoneWorkingSet).reduce((sum, s) => sum + s.kg * s.reps, 0);
      if (v <= 0) continue;
      const p = patternOf(ex.exerciseId, lookup);
      vol.set(p, (vol.get(p) ?? 0) + v);
      total += v;
    }
  }
  if (total <= 0) return [];
  return (Object.keys(PATTERN_TARGETS) as MovementPattern[]).map((pattern) => {
    const v = vol.get(pattern) ?? 0;
    const pct = (v / total) * 100;
    const target = PATTERN_TARGETS[pattern];
    return { pattern, pct, target, onTarget: v > 0 && Math.abs(pct - target) <= TOLERANCE };
  });
}
