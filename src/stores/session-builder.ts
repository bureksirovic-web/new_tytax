/**
 * Session builder (TYTAX v2, G3 core). Pure: no React, no repository, no clock
 * reads — every input is passed in. The workout store and `useWorkout` build
 * drafts from these.
 *
 * Public API
 * - `buildSessionExercise({ exercise?, slot?, history, settings, targetSets?, repTarget?, warmups? })`
 *     → `SessionExercise`. Working sets come from `training.prefillFromHistory`
 *     (kg by the RIR rule, `ghostKg`/`ghostReps` from last time); warm-ups from
 *     `training.generateWarmups(suggestedKg, settings.warmupStrategy,
 *     { barKg: settings.barWeightKg })` are prepended. No history (suggestedKg
 *     0) → no warm-ups. Warm-ups are only generated for loadable modalities
 *     (`tytax`, `custom`): a bar-based ladder means nothing for bodyweight or a
 *     single kettlebell. Set count: `targetSets` → `slot.sets` → last session's
 *     count (with history) → `min(exercise.defaultSets || 3, 3)`.
 *     `restSeconds`: slot, else exercise, else undefined (settings default applies).
 * - `buildProgramSession({ program, sessionIndex, historyByExercise, settings, lookup })`
 *     → `{ sessionName, programId, programSessionId, sessionIndex, exercises }`,
 *     or null for a rest session / a session without exercises / no sessions.
 * - `deloadOffer({ history, lookup, now })` → `{ offer, recovery }`; offer only
 *     when `training.recoveryStatus(...).overall === 'fried'` (legacy rule).
 * - `applyDeload(exercises, settings?)` → `training.deload(exercises)` (−1 working
 *     set, −15 % kg, rounded 1.25). Warm-ups are then made consistent: an
 *     exercise that had warm-ups gets them regenerated from its new first
 *     working kg (with `settings`), or — without `settings` — keeps only the
 *     warm-ups lighter than that kg.
 * - `weakPoint({ history, lookup, catalogExercises, sessionExercises, settings, inventory?, now })`
 *     → `{ muscle, exercise, sets: 2, sessionExercise } | null`. Offered only when
 *     `settings.weakPointInjector` is on AND recovery overall is 'fresh' (legacy
 *     rule: never add volume to a tired body). Lagging muscle =
 *     `training.laggingMuscle(training.impactDistribution(history, lookup, last 7
 *     local days incl. today))`. Candidate: impact ≥ 90 for that muscle
 *     (standardised names), not already in the session, available per
 *     `isAvailable(exercise, inventory)`; fewest impact muscles first
 *     (isolation), then name A–Z. The built exercise has exactly 2 prefilled
 *     working sets and no warm-ups.
 * - `isAvailable(exercise, inventory?)`: see its doc.
 */
import type {
  Program,
  ProfileSettings,
  SessionExercise,
  SetEntry,
  WorkoutLog,
} from '@/contracts/domain';
import type { ExerciseLookup, RecoverySummary } from '@/contracts/training';
import { training } from '@/lib/training';
import { buildSessionExercise } from './session-exercise';

export { buildSessionExercise, MAX_INITIAL_SETS } from './session-exercise';
export type { BuildSessionExerciseInput } from './session-exercise';
export {
  isAvailable,
  weakPoint,
  WEAK_POINT_MIN_IMPACT,
  WEAK_POINT_SETS,
  WEAK_POINT_WINDOW_DAYS,
} from './weak-point';
export type { WeakPointInput, WeakPointPick } from './weak-point';

// ─── Program session ─────────────────────────────────────────────────────────

export interface BuildProgramSessionInput {
  program: Program;
  /** Wrapped into range (negative and overflowing indexes are fine). */
  sessionIndex: number;
  historyByExercise: Readonly<Record<string, readonly WorkoutLog[]>>;
  settings: ProfileSettings;
  lookup: ExerciseLookup;
  /** Owned kettlebells (kg), passed to kettlebell prefill. */
  availableKg?: readonly number[];
}

export interface BuiltProgramSession {
  sessionName: string;
  programId: string;
  programSessionId: string;
  sessionIndex: number;
  exercises: SessionExercise[];
}

export function wrapIndex(index: number, length: number): number {
  if (length <= 0) return 0;
  const i = Math.floor(index);
  return ((i % length) + length) % length;
}

export function buildProgramSession(input: BuildProgramSessionInput): BuiltProgramSession | null {
  const { program, settings, lookup, historyByExercise } = input;
  if (program.sessions.length === 0) return null;
  const idx = wrapIndex(input.sessionIndex, program.sessions.length);
  const session = program.sessions[idx];
  if (!session || session.isRest || session.exercises.length === 0) return null;
  const exercises = session.exercises.map((slot) =>
    buildSessionExercise({
      slot,
      exercise: lookup(slot.exerciseId),
      history: historyByExercise[slot.exerciseId] ?? [],
      settings,
      availableKg: input.availableKg,
    }),
  );
  return { sessionName: session.name, programId: program.id, programSessionId: session.id, sessionIndex: idx, exercises };
}

// ─── Deload ──────────────────────────────────────────────────────────────────

export interface DeloadOfferInput {
  history: readonly WorkoutLog[];
  lookup: ExerciseLookup;
  now: Date;
}

export function deloadOffer(input: DeloadOfferInput): { offer: boolean; recovery: RecoverySummary } {
  const recovery = training.recoveryStatus(input.history, input.lookup, input.now);
  return { offer: recovery.overall === 'fried', recovery };
}

type WarmupSettings = Pick<ProfileSettings, 'warmupStrategy' | 'barWeightKg'>;

export function applyDeload(exercises: readonly SessionExercise[], settings?: WarmupSettings): SessionExercise[] {
  return training.deload(exercises).map((ex) => {
    const warm = ex.sets.filter((s) => s.type === 'warmup');
    const work = ex.sets.filter((s) => s.type !== 'warmup');
    if (warm.length === 0) return ex;
    const firstKg = work[0]?.kg ?? 0;
    const nextWarm: SetEntry[] = settings
      ? training.generateWarmups(firstKg, settings.warmupStrategy, { barKg: settings.barWeightKg })
      : warm.filter((s) => s.kg < firstKg);
    return { ...ex, sets: [...nextWarm, ...work] };
  });
}

