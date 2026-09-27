/**
 * Pure read-only views over a workout draft for the UI. They follow the
 * training contract: only done sets that are not warm-ups count.
 *
 * Time sets mirror G1 (`@/lib/training`): a set with `durationSeconds` > 0
 * (`isTimeSet`) is seconds held. It counts as a done set, never adds kg volume,
 * and its seconds are the hold total (`holdSeconds`). With an explicit 'time'
 * measure, a set with no seconds is not logged work, whatever its reps.
 * Without a measure, reps count: a stray `durationSeconds: 0` never turns
 * logged rep work into nothing (refuter-2 F5; the finish guard uses this).
 */
import type { ExerciseMeasure, SessionExercise, SetEntry, WorkoutDraft } from '@/contracts/domain';
import { holdSeconds, isTimeSet as isHeldSet } from '@/lib/training';

export interface DraftSummary {
  exerciseCount: number;
  /** Done working sets with reps, or with seconds for time sets (warm-ups, undone and empty sets excluded). */
  doneSets: number;
  /** All sets, done or not. */
  totalSets: number;
  /** Σ kg × reps over done working rep sets (time sets excluded). */
  volumeKg: number;
  /** Seconds held: Σ G1 `holdSeconds(sets)` over the exercises. */
  timeSeconds: number;
}

export interface SummaryOptions {
  /** Measure per exercise id (e.g. `measureOf(catalog.getById(id))`). */
  measureOf?: (exerciseId: string) => ExerciseMeasure;
}

/**
 * A done, non-warm-up set with reps (or seconds, for a time set): an empty set
 * is never logged work. One argument only, so it stays safe as an
 * `array.filter` callback; `countsAsWorkFor` takes the measure.
 */
export function countsAsWork(s: SetEntry): boolean {
  return countsAsWorkFor(s);
}

export function countsAsWorkFor(s: SetEntry, measure?: ExerciseMeasure): boolean {
  if (!s.done || s.type === 'warmup') return false;
  if (isHeldSet(s)) return true;
  // Refuter-2 F5: only an explicit 'time' measure discards reps; a stray durationSeconds 0 does not.
  return measure !== 'time' && s.reps > 0;
}

/** Counts toward kg volume: logged work that is not a time set (G1 `isTimeSet`). */
export function countsForVolume(s: SetEntry, measure?: ExerciseMeasure): boolean {
  return countsAsWorkFor(s, measure) && !isHeldSet(s);
}

export function exerciseVolumeKg(ex: SessionExercise, measure?: ExerciseMeasure): number {
  return ex.sets.reduce((sum, s) => (countsForVolume(s, measure) ? sum + s.kg * s.reps : sum), 0);
}

export function summarizeDraft(draft: WorkoutDraft, opts: SummaryOptions = {}): DraftSummary {
  let doneSets = 0;
  let totalSets = 0;
  let volumeKg = 0;
  let timeSeconds = 0;
  for (const ex of draft.exercises) {
    const measure = opts.measureOf?.(ex.exerciseId);
    totalSets += ex.sets.length;
    timeSeconds += holdSeconds(ex.sets);
    for (const s of ex.sets) {
      if (!countsAsWorkFor(s, measure)) continue;
      doneSets += 1;
      if (!isHeldSet(s)) volumeKg += s.kg * s.reps;
    }
  }
  return { exerciseCount: draft.exercises.length, doneSets, totalSets, volumeKg, timeSeconds };
}
