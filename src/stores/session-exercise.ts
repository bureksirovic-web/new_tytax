/**
 * `buildSessionExercise` — one prefilled session exercise (pure). Documented in
 * ./session-builder.ts, which re-exports everything here.
 */
import type { Exercise, Modality, ProfileSettings, ProgramExercise, SessionExercise, WorkoutLog } from '@/contracts/domain';
import { newUuid } from '@/lib/db/ids';
import type { PrefillOptions } from '@/contracts/training';
import { training } from '@/lib/training';

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
    (l) => !l.deletedAt && l.exercises.some((e) => e.exerciseId === exerciseId && e.sets.some((s) => s.done && s.type !== 'warmup' && s.reps > 0)),
  );
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
  const wantWarmups = input.warmups !== false && WARMUP_MODALITIES.has(modality) && prefill.suggestedKg > 0;
  const warm = wantWarmups
    ? training.generateWarmups(prefill.suggestedKg, settings.warmupStrategy, { barKg: settings.barWeightKg })
    : [];
  const out: SessionExercise = {
    uid: newUuid(),
    exerciseId,
    exerciseName: slot?.exerciseName ?? exercise?.name ?? exerciseId,
    modality,
    sets: [...warm, ...prefill.sets],
  };
  const rest = slot?.restSeconds ?? exercise?.restSeconds;
  if (rest !== undefined) out.restSeconds = rest;
  if (slot?.supersetGroup !== undefined) out.supersetGroup = slot.supersetGroup;
  const snapshot = snapshotOf(exercise);
  if (snapshot) out.muscleImpactSnapshot = snapshot;
  return out;
}
