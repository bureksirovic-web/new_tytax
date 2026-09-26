/**
 * "Ghost" reps: what you did on the same working set last session.
 *
 * The ghost values themselves are filled in by `training.prefillFromHistory`
 * (src/lib/training/prefill.ts, `SetEntry.ghostReps`, indexed among working
 * sets only). This module keeps the one comparison the set row needs; e1RM
 * always comes from `training.e1rm`.
 */

function validReps(reps: unknown): reps is number {
  return typeof reps === 'number' && Number.isFinite(reps) && reps > 0;
}

/** True when `reps` strictly beats the ghost (both must be positive rep counts). */
export function beatsGhost(
  reps: number | null | undefined,
  ghost: number | null | undefined,
): boolean {
  if (!validReps(reps) || !validReps(ghost)) return false;
  return reps > ghost;
}
