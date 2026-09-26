/**
 * Pure read-only views over a workout draft for the UI. They follow the
 * training contract: only done sets that are not warm-ups count.
 */
import type { SessionExercise, SetEntry, WorkoutDraft } from '@/contracts/domain';

export interface DraftSummary {
  exerciseCount: number;
  /** Done working sets with reps (warm-ups, undone and 0-rep sets excluded). */
  doneSets: number;
  /** All sets, done or not. */
  totalSets: number;
  /** Σ kg × reps over done working sets. */
  volumeKg: number;
}

/** A done, non-warm-up set with reps: a 0-rep set is never logged work. */
export function countsAsWork(s: SetEntry): boolean {
  return s.done && s.type !== 'warmup' && s.reps > 0;
}

export function exerciseVolumeKg(ex: SessionExercise): number {
  return ex.sets.reduce((sum, s) => (countsAsWork(s) ? sum + s.kg * s.reps : sum), 0);
}

export function summarizeDraft(draft: WorkoutDraft): DraftSummary {
  let doneSets = 0;
  let totalSets = 0;
  let volumeKg = 0;
  for (const ex of draft.exercises) {
    totalSets += ex.sets.length;
    for (const s of ex.sets) {
      if (!countsAsWork(s)) continue;
      doneSets += 1;
      volumeKg += s.kg * s.reps;
    }
  }
  return { exerciseCount: draft.exercises.length, doneSets, totalSets, volumeKg };
}
