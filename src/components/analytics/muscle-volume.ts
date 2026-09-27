/**
 * Impact-weighted kg volume per muscle for the analytics screen, via
 * `lib/analytics` (F8). Two library signatures exist while Wave 2 merges:
 *   - v2-g4 today: `volumeByMuscle(logs)` reads only `muscleImpactSnapshot`,
 *     so program-started logs (no snapshot) added no muscle volume;
 *   - G1 (F8): `volumeByMuscle(logs, { lookup })` reads the catalog impact,
 *     falling back to the snapshot.
 * The adapter serves both: it always passes `{ lookup }` (ignored by the old
 * one-argument function) and fills a missing snapshot from the catalog first,
 * so the old signature sees the same impact the new one would. Time-measured
 * sets (`durationSeconds`) are dropped: they have no kg × reps volume.
 */
import type { SessionExercise, WorkoutLog } from '@/contracts/domain';
import type { ExerciseLookup } from '@/contracts/training';
import { volumeByMuscle } from '@/lib/analytics/volume';

type LookupOpts = { lookup?: ExerciseLookup };
/** Structural superset of both signatures; the one-argument form ignores `opts`. */
type VolumeByMuscleFn = (logs: readonly WorkoutLog[], opts?: LookupOpts) => Record<string, number>;

const byMuscle: VolumeByMuscleFn = volumeByMuscle as VolumeByMuscleFn;

function prepareExercise(ex: SessionExercise, lookup: ExerciseLookup): SessionExercise {
  const sets = ex.sets.filter((s) => typeof s.durationSeconds !== 'number');
  const snapshot = ex.muscleImpactSnapshot ?? lookup(ex.exerciseId)?.impact;
  return { ...ex, sets, ...(snapshot ? { muscleImpactSnapshot: snapshot } : {}) };
}

/** Logs with time-measured sets removed and missing impact snapshots filled from the catalog. */
export function prepareForMuscleVolume(logs: readonly WorkoutLog[], lookup: ExerciseLookup): WorkoutLog[] {
  return logs.map((log) => ({ ...log, exercises: log.exercises.map((ex) => prepareExercise(ex, lookup)) }));
}

/**
 * kg volume per standardised muscle (largest first) over done working kg sets
 * of live logs. Muscles without volume are left out (the one-argument library
 * version adds 0 entries for exercises with no kg volume; G1's skips them).
 */
export function muscleVolumeKg(logs: readonly WorkoutLog[], lookup: ExerciseLookup): Record<string, number> {
  const all = byMuscle(prepareForMuscleVolume(logs, lookup), { lookup });
  return Object.fromEntries(Object.entries(all).filter(([, kg]) => kg > 0));
}
