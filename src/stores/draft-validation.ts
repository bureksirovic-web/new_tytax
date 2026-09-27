/**
 * Validation of a persisted workout draft (localStorage is untrusted input:
 * another tab, an old build, a hand edit). Two entry points:
 *
 * - `isWorkoutDraft(v)`: strict predicate. A set needs a non-empty string id,
 *   a known `type`, `kg` finite ≥ 0, `reps` an integer 0–`MAX_REPS`, a boolean
 *   `done`, `rir` absent or 0–5, `durationSeconds` absent or finite ≥ 0. An
 *   exercise needs string uid/exerciseId/exerciseName, a known `modality` and
 *   unique set ids. The draft needs string id/profileId/sessionName, a
 *   parseable `startedAt` and unique exercise uids.
 * - `sanitizeDraft(v, nowIso)`: repairs instead of dropping the whole workout
 *   for one bad row. Returns null only when the draft's identity is broken
 *   (id/profileId/sessionName not strings, exercises not an array). Otherwise:
 *   rir outside 0–5 is clamped (non-numeric rir removed); non-integer reps are
 *   rounded; a set still invalid (negative / non-finite kg, reps < 0 or
 *   > `MAX_REPS`, unknown type, bad seconds, no id) is dropped (the reps field
 *   and `updateSet` clamp to `MAX_REPS`, so the app itself never writes more); an exercise
 *   with a broken shape or unknown modality is dropped; a duplicate set id or
 *   exercise uid gets a fresh one; an unparseable `startedAt` becomes the
 *   earliest valid `completedAt` of a done set, else `nowIso`. The result
 *   always satisfies `isWorkoutDraft`.
 */
import type { Modality, SessionExercise, SetEntry, SetType, WorkoutDraft } from '@/contracts/domain';
import { newUuid } from '@/lib/db/ids';
import { MAX_SET_REPS } from '@/lib/constants';

export const MAX_REPS = MAX_SET_REPS;
export const MAX_RIR = 5;

const SET_TYPES: ReadonlySet<string> = new Set<SetType>(['warmup', 'working', 'drop', 'failure']);
const MODALITIES: ReadonlySet<string> = new Set<Modality>(['tytax', 'bodyweight', 'kettlebell', 'custom']);

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isId = (v: unknown): v is string => typeof v === 'string' && v.length > 0;
const isDate = (v: unknown): v is string => typeof v === 'string' && !Number.isNaN(Date.parse(v));

export function isValidSet(v: unknown): v is SetEntry {
  return (
    isRecord(v) &&
    isId(v.id) &&
    typeof v.type === 'string' &&
    SET_TYPES.has(v.type) &&
    isFiniteNumber(v.kg) &&
    v.kg >= 0 &&
    Number.isInteger(v.reps) &&
    (v.reps as number) >= 0 &&
    (v.reps as number) <= MAX_REPS &&
    typeof v.done === 'boolean' &&
    (v.rir === undefined || (isFiniteNumber(v.rir) && v.rir >= 0 && v.rir <= MAX_RIR)) &&
    (v.durationSeconds === undefined || (isFiniteNumber(v.durationSeconds) && v.durationSeconds >= 0))
  );
}

function hasExerciseShape(v: unknown): v is Record<string, unknown> & { sets: unknown[] } {
  return (
    isRecord(v) &&
    isId(v.uid) &&
    typeof v.exerciseId === 'string' &&
    typeof v.exerciseName === 'string' &&
    typeof v.modality === 'string' &&
    MODALITIES.has(v.modality) &&
    Array.isArray(v.sets)
  );
}

const uniqueBy = <T>(xs: readonly T[], key: (x: T) => string): boolean => new Set(xs.map(key)).size === xs.length;

function isSessionExercise(v: unknown): v is SessionExercise {
  return hasExerciseShape(v) && v.sets.every(isValidSet) && uniqueBy(v.sets as SetEntry[], (s) => s.id);
}

export function isWorkoutDraft(v: unknown): v is WorkoutDraft {
  return (
    isRecord(v) &&
    typeof v.id === 'string' &&
    typeof v.profileId === 'string' &&
    typeof v.sessionName === 'string' &&
    isDate(v.startedAt) &&
    Array.isArray(v.exercises) &&
    v.exercises.every(isSessionExercise) &&
    uniqueBy(v.exercises as SessionExercise[], (e) => e.uid)
  );
}

/** A repaired copy of one set, or null when it cannot be repaired. */
function repairSet(v: unknown): SetEntry | null {
  if (!isRecord(v)) return null;
  const out: Record<string, unknown> = { ...v };
  if (out.rir !== undefined) {
    if (isFiniteNumber(out.rir)) out.rir = Math.min(MAX_RIR, Math.max(0, out.rir));
    else delete out.rir;
  }
  if (isFiniteNumber(out.reps) && !Number.isInteger(out.reps)) out.reps = Math.round(out.reps);
  return isValidSet(out) ? out : null;
}

function earliestCompletedAt(exercises: readonly SessionExercise[]): string | undefined {
  let best: string | undefined;
  for (const ex of exercises) {
    for (const s of ex.sets) {
      if (s.done && isDate(s.completedAt) && (best === undefined || Date.parse(s.completedAt) < Date.parse(best))) best = s.completedAt;
    }
  }
  return best;
}

export function sanitizeDraft(v: unknown, nowIso: string): WorkoutDraft | null {
  if (!isRecord(v) || typeof v.id !== 'string' || typeof v.profileId !== 'string' || typeof v.sessionName !== 'string') return null;
  if (!Array.isArray(v.exercises)) return null;
  const uids = new Set<string>();
  const exercises: SessionExercise[] = [];
  for (const raw of v.exercises) {
    if (!hasExerciseShape(raw)) continue;
    const setIds = new Set<string>();
    const sets: SetEntry[] = [];
    for (const rawSet of raw.sets) {
      const s = repairSet(rawSet);
      if (!s) continue;
      if (setIds.has(s.id)) s.id = newUuid();
      setIds.add(s.id);
      sets.push(s);
    }
    const uid = uids.has(raw.uid as string) ? newUuid() : (raw.uid as string);
    uids.add(uid);
    exercises.push({ ...(raw as unknown as SessionExercise), uid, sets });
  }
  const startedAt = isDate(v.startedAt) ? v.startedAt : (earliestCompletedAt(exercises) ?? nowIso);
  return { ...(v as unknown as WorkoutDraft), startedAt, exercises };
}
