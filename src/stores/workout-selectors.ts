/**
 * Pure read-only views over a workout draft for the UI. They follow the
 * training contract: only done sets that are not warm-ups count.
 *
 * Time sets (Wave 2, see ./measure.ts): a done time set counts as a done set
 * when `durationSeconds > 0` (reps are ignored) and never adds kg volume.
 * Without a `measureOf` lookup a set is a time set when it carries
 * `durationSeconds`; with one, the exercise's measure decides.
 */
import type { ExerciseMeasure, SessionExercise, SetEntry, WorkoutDraft } from '@/contracts/domain';
import { isTimeSet } from './measure';

export interface DraftSummary {
  exerciseCount: number;
  /** Done working sets with reps, or with seconds for time sets (warm-ups, undone and empty sets excluded). */
  doneSets: number;
  /** All sets, done or not. */
  totalSets: number;
  /** Σ kg × reps over done working rep sets (time sets excluded). */
  volumeKg: number;
  /** Σ seconds over done working time sets. */
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
  return isTimeSet(s, measure) ? (s.durationSeconds ?? 0) > 0 : s.reps > 0;
}

/** Counts toward kg volume: logged work that is not a time set. */
export function countsForVolume(s: SetEntry, measure?: ExerciseMeasure): boolean {
  return countsAsWorkFor(s, measure) && !isTimeSet(s, measure);
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
    for (const s of ex.sets) {
      if (!countsAsWorkFor(s, measure)) continue;
      doneSets += 1;
      if (isTimeSet(s, measure)) timeSeconds += s.durationSeconds ?? 0;
      else volumeKg += s.kg * s.reps;
    }
  }
  return { exerciseCount: draft.exercises.length, doneSets, totalSets, volumeKg, timeSeconds };
}
