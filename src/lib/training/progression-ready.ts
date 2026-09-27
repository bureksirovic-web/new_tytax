/**
 * Progression-prompt readiness (TYTAX v2, family-profiles plan, piece 4).
 * Pure function: no repository, no clock reads beyond what the caller
 * resolves into `youth` up front (see `isYouthProfile`).
 *
 * Where the inputs come from (debrief integration, src/components/workout):
 * - `logs`: the in-progress draft (if any, prepended) followed by
 *   `LogsRepo.historyFor(profileId, exerciseId)` (newest first). Readiness is
 *   computed BEFORE `finish()` drops the draft, so the just-finished workout
 *   counts as the most recent session.
 * - `target`: the exercise's own range, normally `catalogLookup(exerciseId)?.defaultReps`.
 * - `catalogLookup`: a loaded `Catalog.getById` (bodyweight chunk), lazy-loaded
 *   so the debrief route's first-load JS stays free of catalog data
 *   (`npm run check-bundle`).
 */
import type { Exercise, SessionExercise } from '@/contracts/domain';
import { parseTarget } from './targets';

/** The shape `readyToProgress` needs from a session: a `WorkoutDraft` or a `WorkoutLog` both satisfy it. */
export interface ProgressionSession {
  id: string;
  exercises: readonly SessionExercise[];
  isDeload?: boolean;
  deletedAt?: string;
}

export type ProgressionReason =
  | 'ready'
  | 'no-progression-child'
  | 'not-enough-sessions'
  | 'sets-below-target'
  | 'youth-boundary';

export interface ReadyToProgressInput {
  exerciseId: string;
  /** Newest-first (draft, if any, then history as `LogsRepo.historyFor` returns it). */
  logs: readonly ProgressionSession[];
  /** The exercise's target range text, e.g. "8-12", "10-30s/side". */
  target: string;
  /** Whether the profile is under 16 (see `isYouthProfile`). */
  youth: boolean;
  catalogLookup: (exerciseId: string) => Exercise | undefined;
}

export interface ReadyToProgressResult {
  ready: boolean;
  /** Present whenever the exercise has a next step, ready or not. */
  nextExerciseId?: string;
  reason: ProgressionReason;
}

/**
 * Reviewed steps a profile under 16 may be offered (Astra blocker 2,
 * PLAN-family-profiles.md "Amendments after 1b"). A next step outside this
 * set is never prompted for a youth profile, however qualified the sessions
 * — dip never goes past parallel-bar dip (no ring, no Korean).
 *
 * `bw_dip_negative-dip` and `bw_core_tuck-l-sit` are added by the youth-preset
 * piece (piece 3) of this plan; they are listed here ahead of that catalog
 * entry landing, per instruction. The coordinator reconciles ids that drift.
 */
export const YOUTH_PROGRESSION_ALLOWLIST: ReadonlySet<string> = new Set<string>([
  // Dip: bench dip -> support hold -> negative dip -> parallel-bar dip.
  'bw_upper_dip-support-hold',
  'bw_dip_negative-dip',
  'bw_dip_parallel-bar-dip',
  // Push-up: up to standard / diamond.
  'bw_push_incline-push-up',
  'bw_push_knee-push-up',
  'bw_push_standard-push-up',
  'bw_push_diamond-push-up',
  // Pull: up to negative pull-up and pull-up.
  'bw_pull_active-hang',
  'bw_pull_scapular-pull-up',
  'bw_pull_negative-pull-up',
  'bw_pull_pull-up',
  // Squat: up to Bulgarian split squat.
  'bw_squat_pause-squat',
  'bw_squat_jump-squat',
  'bw_squat_bulgarian-split-squat',
  // Core: up to tuck L-sit and hanging knee raise.
  'bw_core_hollow-body',
  'bw_core_leg-raise',
  'bw_core_hanging-knee-raise',
  'bw_core_tuck-l-sit',
]);

/**
 * A profile counts as youth when age (current year − birth year) is under
 * 16. `birthYear` is undefined for a profile that has not set one (or on a
 * build before that additive contract field lands): never youth then.
 */
export function isYouthProfile(birthYear: number | undefined, now: Date): boolean {
  if (birthYear === undefined || !Number.isFinite(birthYear)) return false;
  return now.getFullYear() - birthYear < 16;
}

function sessionQualifies(session: ProgressionSession, exerciseId: string, target: string): boolean {
  const parsed = parseTarget(target);
  const workingSets = session.exercises
    .filter((e) => e.exerciseId === exerciseId)
    .flatMap((e) => e.sets)
    .filter((s) => s.type === 'working');
  if (workingSets.length === 0) return false;
  return workingSets.every((s) => {
    if (!s.done) return false;
    return parsed.unit === 's' ? (s.durationSeconds ?? 0) >= parsed.max : s.reps >= parsed.max;
  });
}

/**
 * Ready only when the exercise has a next progression step, that step is
 * allowed for a youth profile when `youth` is true, and the 2 most recent
 * distinct sessions (not soft-deleted, not deload) containing the exercise
 * both had every prescribed working set done at or above the top of `target`.
 */
export function readyToProgress(input: ReadyToProgressInput): ReadyToProgressResult {
  const { exerciseId, logs, target, youth, catalogLookup } = input;

  const exercise = catalogLookup(exerciseId);
  const nextExerciseId = exercise?.progressionChildIds?.[0];
  if (!nextExerciseId) return { ready: false, reason: 'no-progression-child' };

  if (youth && !YOUTH_PROGRESSION_ALLOWLIST.has(nextExerciseId)) {
    return { ready: false, nextExerciseId, reason: 'youth-boundary' };
  }

  const eligible = logs.filter(
    (s) => s.deletedAt === undefined && s.isDeload !== true && s.exercises.some((e) => e.exerciseId === exerciseId),
  );
  const recentTwo = eligible.slice(0, 2);
  if (recentTwo.length < 2) return { ready: false, nextExerciseId, reason: 'not-enough-sessions' };

  const allQualify = recentTwo.every((session) => sessionQualifies(session, exerciseId, target));
  if (!allQualify) return { ready: false, nextExerciseId, reason: 'sets-below-target' };

  return { ready: true, nextExerciseId, reason: 'ready' };
}
