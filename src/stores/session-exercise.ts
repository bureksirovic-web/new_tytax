/**
 * `buildSessionExercise` — one prefilled session exercise (pure). Documented in
 * ./session-builder.ts, which re-exports everything here.
 *
 * Time exercises (Wave 2): `input.measure`, else `measureOf(exercise)`. A time
 * exercise gets NO warm-ups; its working sets (same count rule as reps) are
 * `kg 0, reps 0, durationSeconds` = the duration of the done working set at
 * the same working index in the newest (non-deleted) log containing the
 * exercise; past that session's last set, its last done duration. No history
 * → no `durationSeconds` (the input starts empty). Holds are repeated, never
 * progressed, and time sets carry no kg/reps ghosts.
 */
import type { Exercise, ExerciseMeasure, Modality, ProfileSettings, ProgramExercise, SessionExercise, SetEntry, WorkoutLog } from '@/contracts/domain';
import { newUuid } from '@/lib/db/ids';
import type { PrefillOptions } from '@/contracts/training';
import { training } from '@/lib/training';
import { cleanSeconds, measureOf } from './measure';

/** Most sets a freshly added exercise gets without history or a slot. */
export const MAX_INITIAL_SETS = 3;

const WARMUP_MODALITIES: ReadonlySet<Modality> = new Set<Modality>(['tytax', 'custom']);

export interface BuildSessionExerciseInput {
  /** Catalog entry (name, modality, impact snapshot, rest, default sets). */
  exercise?: Exercise;
  /** Program slot; wins over `exercise` for id, name, modality, rest and set count. */
  slot?: ProgramExercise;
  /** Any logs (any order); the newest one containing the exercise is used. */
  history: readonly WorkoutLog[];
  settings: ProfileSettings;
  targetSets?: number;
  repTarget?: string;
  /** Default true. */
  warmups?: boolean;
  /** Kettlebells the profile owns (`EquipmentInventory.kettlebellsKg`); prefill snaps to a real bell. */
  availableKg?: readonly number[];
  /** Overrides `measureOf(exercise)` (e.g. a slot without a catalog entry). */
  measure?: ExerciseMeasure;
}

/**
 * `availableKg` is additive in `PrefillOptions` (request G1-02, lands with
 * v2-g1). Typed as an intersection so this compiles before and after that merge.
 */
type PrefillOptionsWithBells = PrefillOptions & { availableKg?: readonly number[] };

function snapshotOf(ex: Exercise | undefined): SessionExercise['muscleImpactSnapshot'] {
  return ex ? ex.impact.map((m) => ({ muscle: m.muscle, score: m.score })) : undefined;
}

function hasLoggedSets(exerciseId: string, history: readonly WorkoutLog[]): boolean {
  return history.some(
    (l) => !l.deletedAt && l.exercises.some((e) => e.exerciseId === exerciseId && e.sets.some((s) => s.done && s.type !== 'warmup' && (s.reps > 0 || cleanSeconds(s.durationSeconds) > 0))),
  );
}

/** Durations of the last session's working sets, by working index (undefined: not done / no seconds). */
export function lastDurations(exerciseId: string, history: readonly WorkoutLog[]): Array<number | undefined> {
  let newest: WorkoutLog | undefined;
  for (const l of history) {
    if (l.deletedAt || !l.exercises.some((e) => e.exerciseId === exerciseId)) continue;
    if (!newest || l.startedAt > newest.startedAt) newest = l;
  }
  if (!newest) return [];
  return newest.exercises
    .filter((e) => e.exerciseId === exerciseId)
    .flatMap((e) => e.sets.filter((s) => s.type !== 'warmup'))
    .map((s) => (s.done && cleanSeconds(s.durationSeconds) > 0 ? cleanSeconds(s.durationSeconds) : undefined));
}

/** `targetSets` when known, else as many sets as last session had (at least one). */
function timeSets(targetSets: number | undefined, exerciseId: string, history: readonly WorkoutLog[]): SetEntry[] {
  const last = lastDurations(exerciseId, history);
  const lastDone = last.filter((d) => d !== undefined).at(-1);
  const count = Math.max(1, Math.floor(targetSets ?? last.length));
  return Array.from({ length: count }, (_, i) => {
    const set: SetEntry = { id: newUuid(), type: 'working', kg: 0, reps: 0, done: false };
    const seconds = i < last.length ? last[i] : lastDone;
    if (seconds !== undefined) set.durationSeconds = seconds;
    return set;
  });
}

export function buildSessionExercise(input: BuildSessionExerciseInput): SessionExercise {
  const { exercise, slot, history, settings } = input;
  const exerciseId = slot?.exerciseId ?? exercise?.id;
  if (!exerciseId) throw new Error('buildSessionExercise needs an exercise or a slot');
  const modality: Modality = slot?.modality ?? exercise?.modality ?? 'custom';
  let targetSets = input.targetSets ?? (slot && slot.sets > 0 ? slot.sets : undefined);
  if (targetSets === undefined && !hasLoggedSets(exerciseId, history)) {
    targetSets = Math.min(exercise?.defaultSets || MAX_INITIAL_SETS, MAX_INITIAL_SETS);
  }
  const options: PrefillOptionsWithBells = { targetSets, repTarget: input.repTarget ?? slot?.reps };
  if (modality === 'kettlebell' && input.availableKg && input.availableKg.length > 0) options.availableKg = input.availableKg;
  const prefill = training.prefillFromHistory(exerciseId, history, options);
  const isTime = (input.measure ?? measureOf(exercise)) === 'time';
  const wantWarmups = !isTime && input.warmups !== false && WARMUP_MODALITIES.has(modality) && prefill.suggestedKg > 0;
  const warm = wantWarmups
    ? training.generateWarmups(prefill.suggestedKg, settings.warmupStrategy, { barKg: settings.barWeightKg })
    : [];
  const out: SessionExercise = {
    uid: newUuid(),
    exerciseId,
    exerciseName: slot?.exerciseName ?? exercise?.name ?? exerciseId,
    modality,
    sets: isTime ? timeSets(targetSets, exerciseId, history) : [...warm, ...prefill.sets],
  };
  const rest = slot?.restSeconds ?? exercise?.restSeconds;
  if (rest !== undefined) out.restSeconds = rest;
  if (slot?.supersetGroup !== undefined) out.supersetGroup = slot.supersetGroup;
  const snapshot = snapshotOf(exercise);
  if (snapshot) out.muscleImpactSnapshot = snapshot;
  return out;
}
