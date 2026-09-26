/**
 * Runtime adapters over G1's Wave 2 training exports (G4-41, F2/F3). On a
 * tree where `@/lib/training` exports `rankableE1rm` / `E1RM_MAX_REPS` /
 * `isTimeSet` they are used; otherwise the local copies below apply the same
 * rules, so v2-g4 keeps working before the merge. Read through the module
 * namespace so a missing export is `undefined`, never a build error. Used by
 * analytics, history, the dashboard pinned card and the exercise detail.
 */
import type { SetEntry } from '@/contracts/domain';
import * as trainingModule from '@/lib/training';
import { isDoneWorkingSet, training } from '@/lib/training';

type Mod = Record<string, unknown> | undefined;
type RankableSet = Pick<SetEntry, 'kg' | 'reps' | 'durationSeconds' | 'done' | 'type'>;

/** Local copy of G1's `E1RM_MAX_REPS`: e1RM from more reps is unreliable (Brzycki pole at 37). */
export const FALLBACK_E1RM_MAX_REPS = 12;

const exportOf = (mod: unknown, name: string): unknown => (mod as Mod)?.[name];

/** Highest rep count an e1RM is ranked for: G1's `E1RM_MAX_REPS` when exported, else 12. */
export function e1rmMaxReps(mod: unknown = trainingModule): number {
  const value = exportOf(mod, 'E1RM_MAX_REPS');
  return typeof value === 'number' && value > 0 ? value : FALLBACK_E1RM_MAX_REPS;
}

/** Local rule while G1's `isTimeSet` is missing: the set carries a duration. */
export function localIsTimeSet(s: Pick<SetEntry, 'durationSeconds'>): boolean {
  return s.durationSeconds != null;
}

/** A time-measured set (hold/carry/stretch): G1's `isTimeSet` when exported, else `durationSeconds != null`. */
export function isTimeSetG1(s: Pick<SetEntry, 'durationSeconds'>, mod: unknown = trainingModule): boolean {
  const fn = exportOf(mod, 'isTimeSet');
  return typeof fn === 'function' ? Boolean((fn as (set: typeof s) => unknown)(s)) : localIsTimeSet(s);
}

/**
 * Local copy of G1's `rankableE1rm`: undefined for undone, warm-up, time,
 * kg ≤ 0, reps ≤ 0 or reps > `E1RM_MAX_REPS` sets; else `training.e1rm`
 * rounded to 0.01 kg.
 */
export function localRankableE1rm(s: RankableSet, maxReps: number = FALLBACK_E1RM_MAX_REPS): number | undefined {
  if (localIsTimeSet(s) || !isDoneWorkingSet(s as SetEntry)) return undefined;
  if (!(s.kg > 0) || !(s.reps > 0) || s.reps > maxReps) return undefined;
  return Math.round(training.e1rm(s.kg, s.reps) * 100) / 100;
}

/** The e1RM a set may be ranked by, or undefined: G1's `rankableE1rm` when exported, else the local copy. */
export function rankableE1rmG1(s: RankableSet, mod: unknown = trainingModule): number | undefined {
  const fn = exportOf(mod, 'rankableE1rm');
  if (typeof fn !== 'function') return localRankableE1rm(s, e1rmMaxReps(mod));
  const value = (fn as (set: RankableSet) => unknown)(s);
  return typeof value === 'number' && value > 0 ? value : undefined;
}
