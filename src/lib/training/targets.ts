/**
 * Shared parser for an exercise's target-range text (`Exercise.defaultReps`,
 * `ProgramExercise.reps`): "8-12", "10", "8/side", "10-15/leg", "10-30s",
 * "30s/side". Used by the progression-readiness check (./progression-ready)
 * and the youth-preset data test, so both read the same range the same way.
 *
 * NOTE: a second copy of this exact file/API may exist under the same path
 * from a parallel piece of the family-profiles plan; the coordinator
 * reconciles duplicates before merge.
 */

export type TargetUnit = 'reps' | 's';

export interface ParsedTarget {
  min: number;
  max: number;
  unit: TargetUnit;
  /** "/side" or "/leg" suffix: the range is per side/leg, not a session total. */
  perSide: boolean;
}

// <min>[-<max>][s][/side|/leg]. A single number is both min and max.
const TARGET_RE = /^(\d+(?:\.\d+)?)\s*(?:-\s*(\d+(?:\.\d+)?))?\s*(s)?\s*(?:\/\s*(side|leg))?$/i;

/**
 * Parses a target-range string. Throws on text that does not match the
 * shape above (a caller with untrusted/free-text input should catch it).
 */
export function parseTarget(raw: string): ParsedTarget {
  const trimmed = raw.trim();
  const m = TARGET_RE.exec(trimmed);
  if (!m) throw new Error(`parseTarget: unparseable target "${raw}"`);
  const min = Number(m[1]);
  const max = m[2] !== undefined ? Number(m[2]) : min;
  const unit: TargetUnit = m[3] ? 's' : 'reps';
  const perSide = m[4] !== undefined;
  return { min, max, unit, perSide };
}
