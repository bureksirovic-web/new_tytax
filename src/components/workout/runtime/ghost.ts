/**
 * "Ghost" reps: what you did on the same working set last session.
 *
 * Only WORKING sets of the previous session count, indexed among working sets
 * only. (Legacy used the raw set index, so warm-ups shifted every ghost.)
 */

export type SetKind = 'warmup' | 'working';

export interface GhostSetLike {
  reps: number | null;
  type: SetKind;
  done?: boolean;
}

export interface GhostOptions {
  /** Ignore previous sets that were never marked done. Default false. */
  onlyDone?: boolean;
}

function validReps(reps: unknown): reps is number {
  return typeof reps === 'number' && Number.isFinite(reps) && reps > 0;
}

/** Ghost reps for the `setIndexAmongWorking`-th working set, or null. */
export function ghostRepsFor(
  prevSets: readonly GhostSetLike[] | null | undefined,
  setIndexAmongWorking: number,
  options: GhostOptions = {},
): number | null {
  if (!prevSets || !Number.isInteger(setIndexAmongWorking) || setIndexAmongWorking < 0) {
    return null;
  }
  const working = prevSets.filter(
    (s) => s.type === 'working' && (!options.onlyDone || s.done === true),
  );
  const reps = working[setIndexAmongWorking]?.reps;
  return validReps(reps) ? reps : null;
}

/** Index of `setIndex` among the working sets of `sets` (null for warm-ups). */
export function workingIndexOf(
  sets: readonly Pick<GhostSetLike, 'type'>[],
  setIndex: number,
): number | null {
  if (sets[setIndex]?.type !== 'working') return null;
  let count = 0;
  for (let i = 0; i < setIndex; i++) if (sets[i].type === 'working') count++;
  return count;
}

/** True when `reps` strictly beats the ghost. */
export function beatsGhost(
  reps: number | null | undefined,
  ghost: number | null | undefined,
): boolean {
  if (!validReps(reps) || !validReps(ghost)) return false;
  return reps > ghost;
}

/**
 * Estimated 1RM for display. Brzycki up to 10 reps, Epley above (Brzycki
 * blows up long before its pole at 37; the two agree exactly at 10 reps, so
 * the curve is continuous). 1 rep returns the weight itself. Invalid -> null.
 */
export function e1rmBrzycki(
  kg: number | null | undefined,
  reps: number | null | undefined,
): number | null {
  if (typeof kg !== 'number' || !Number.isFinite(kg) || kg <= 0) return null;
  if (typeof reps !== 'number' || !Number.isFinite(reps) || reps < 1) return null;
  if (reps === 1) return kg;
  if (reps > 10) return kg * (1 + reps / 30);
  return (kg * 36) / (37 - reps);
}
