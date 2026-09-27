/**
 * Shared parser for a program slot's `reps` text (`ProgramExercise.reps`,
 * bodyweight `defaultReps`): `'8-12'`, `'10'`, `'8/side'`, `'10-15/leg'`,
 * `'10-30s'`, `'30s/side'`. Used by the youth-preset data test and by the
 * progression-readiness check (another piece) — the API is exactly
 * `parseTarget(str) -> {min, max, unit, perSide} | null`, do not change its shape.
 */
export type TargetUnit = 'reps' | 's';

export interface ParsedTarget {
  min: number;
  max: number;
  unit: TargetUnit;
  perSide: boolean;
}

const TARGET_RE = /^(\d+)(?:\s*-\s*(\d+))?\s*(s)?\s*(?:\/\s*(side|leg))?$/i;

/** `null` for text that is not a plain "<min>[-<max>][s][/side|/leg]" target. */
export function parseTarget(raw: string): ParsedTarget | null {
  const m = TARGET_RE.exec(raw.trim());
  if (!m) return null;
  const min = Number(m[1]);
  const max = m[2] !== undefined ? Number(m[2]) : min;
  if (!Number.isFinite(min) || !Number.isFinite(max) || max < min) return null;
  return { min, max, unit: m[3] ? 's' : 'reps', perSide: m[4] !== undefined };
}
