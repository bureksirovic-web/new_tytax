/**
 * Swap candidates for a session exercise over a loaded catalog.
 * Delegates ranking to runtime `rankSwapCandidates` (same muscle group
 * and/or movement pattern; more than 2 typed characters switch to a name
 * search). The exercise being swapped is always excluded.
 */
import type { Exercise, SessionExercise } from '@/contracts/domain';
import { foldText, rankSwapCandidates } from './runtime/swap-suggestions';

export const SWAP_LIMIT = 30;

export interface SwapCandidatesInput {
  exercise: SessionExercise;
  catalogExercises: readonly Exercise[];
  /** The catalog entry of `exercise`; undefined for exercises the catalog does not know (custom). */
  target: Exercise | undefined;
  query: string;
  isAvailable: (ex: Exercise) => boolean;
  limit?: number;
}

/** True when the query is long enough for name search (> 2 folded chars). */
export function isNameSearch(query: string): boolean {
  return foldText(query).length > 2;
}

export function swapCandidates({
  exercise,
  catalogExercises,
  target,
  query,
  isAvailable,
  limit = SWAP_LIMIT,
}: SwapCandidatesInput): Exercise[] {
  // Without a catalog entry there is no muscle/pattern to match: only name search works.
  if (!target && !isNameSearch(query)) return [];
  // The name-search path reads only the target's id (to exclude it).
  const ranked = rankSwapCandidates<Exercise | { id: string; name: string }>(
    target ?? { id: exercise.exerciseId, name: exercise.exerciseName },
    catalogExercises,
    {
      getId: (ex) => ex.id,
      getName: (ex) => ex.name,
      getMuscle: (ex) => ('muscleGroup' in ex ? ex.muscleGroup : null),
      getPattern: (ex) => ('pattern' in ex ? ex.pattern : null),
      isAvailable: (ex) => 'modality' in ex && isAvailable(ex),
      query,
      limit,
    },
  );
  return ranked as Exercise[];
}
