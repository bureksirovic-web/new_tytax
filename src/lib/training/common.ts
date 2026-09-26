/**
 * Shared helpers for the training engine (pure).
 */
import type { MuscleImpact, SessionExercise, SetEntry, SetType, WorkoutLog } from '@/contracts/domain';
import type { ExerciseLookup } from '@/contracts/training';
import { standardizeMuscle } from '@/lib/constants';
import { generateId } from '@/lib/utils';

const WORKING_TYPES: ReadonlySet<SetType> = new Set<SetType>(['working', 'drop', 'failure']);

/** True for set types that are work (working/drop/failure), false for warm-ups. */
export function isWorkingType(type: SetType): boolean {
  return WORKING_TYPES.has(type);
}

/**
 * A time-measured set (F2): `durationSeconds` > 0 records the seconds held
 * (static holds, carries, stretches); `reps` may be 0. Its effort is time,
 * so it never yields an e1RM, a PR or kg × reps volume, but it still counts
 * as a set for impact, recovery, ACWR and lagging-muscle load.
 */
export function isTimeSet(s: Pick<SetEntry, 'durationSeconds'>): boolean {
  return typeof s.durationSeconds === 'number' && s.durationSeconds > 0;
}

/**
 * A "done working set": `done`, of type working/drop/failure, with a
 * non-negative weight and either reps > 0 or a recorded duration (a time
 * set, see `isTimeSet`). Warm-ups and undone sets never count.
 */
export function isDoneWorkingSet(s: SetEntry): boolean {
  return s.done && WORKING_TYPES.has(s.type) && s.kg >= 0 && (s.reps > 0 || isTimeSet(s));
}

/** Logs that are not soft-deleted. */
export function liveLogs(logs: readonly WorkoutLog[]): WorkoutLog[] {
  return logs.filter((l) => !l.deletedAt);
}

/** Round to the nearest `increment` (> 0), trimming float noise to 1e-6. */
export function roundTo(value: number, increment: number): number {
  if (!(increment > 0)) return value;
  const r = Math.round(value / increment) * increment;
  return Math.round(r * 1e6) / 1e6;
}

/** Trim float noise (e.g. 0.1 + 0.2) to 1e-6. */
export function clean(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}

export function newId(): string {
  return generateId();
}

/**
 * Impact of one session exercise as standardised muscle → weight (score/100).
 * Source: the catalog entry (`lookup`), falling back to the log's
 * `muscleImpactSnapshot`. After standardisation, several raw entries naming
 * the same muscle (e.g. Gastrocnemius + Soleus → Calves) collapse to the
 * highest score, so one set never counts twice for one muscle.
 */
export function impactWeights(ex: SessionExercise, lookup: ExerciseLookup): Map<string, number> {
  const impact: readonly MuscleImpact[] = lookup(ex.exerciseId)?.impact ?? ex.muscleImpactSnapshot ?? [];
  const out = new Map<string, number>();
  for (const i of impact) {
    if (!(i.score > 0)) continue;
    const muscle = standardizeMuscle(i.muscle);
    const w = i.score / 100;
    if (w > (out.get(muscle) ?? 0)) out.set(muscle, w);
  }
  return out;
}

/** Number of done working sets of one session exercise. */
export function doneWorkingCount(ex: SessionExercise): number {
  let n = 0;
  for (const s of ex.sets) if (isDoneWorkingSet(s)) n += 1;
  return n;
}

/**
 * Per-muscle load of one log: Σ over done working sets of score/100.
 * Adds into `into` and returns it.
 */
export function addLogLoad(log: WorkoutLog, lookup: ExerciseLookup, into: Map<string, number>): Map<string, number> {
  for (const ex of log.exercises) {
    const sets = doneWorkingCount(ex);
    if (sets === 0) continue;
    for (const [muscle, w] of impactWeights(ex, lookup)) {
      into.set(muscle, (into.get(muscle) ?? 0) + sets * w);
    }
  }
  return into;
}

/** Epoch ms of when the workout ended (`finishedAt`, falling back to `startedAt`); NaN if unparsable. */
export function logTime(log: WorkoutLog): number {
  const f = Date.parse(log.finishedAt);
  return Number.isNaN(f) ? Date.parse(log.startedAt) : f;
}

export const HOUR_MS = 3_600_000;
export const DAY_MS = 86_400_000;
