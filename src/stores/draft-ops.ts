/**
 * Pure, immutable draft transformations behind the workout store's G3
 * actions (`swapExercise`, `addPreparedExercise`, `prependWarmups`,
 * `replaceExercises`, `startDraft`). Every function returns new objects and
 * never mutates its input; an unknown uid or a null draft returns the input.
 * Wave 2: `draftFromLog` (repeat workout) and `reorderByUids` (order by
 * station / manual reorder).
 */
import type { Exercise, SessionExercise, SetEntry, WorkoutDraft, WorkoutLog } from '@/contracts/domain';
import { newUuid } from '@/lib/db/ids';

const newId = newUuid;

export interface StartDraftInput {
  profileId: string;
  sessionName: string;
  programId?: string;
  programSessionId?: string;
  exercises?: readonly SessionExercise[];
  isDeload?: boolean;
  notes?: string;
}

export function makeDraft(input: StartDraftInput, startedAt: string): WorkoutDraft {
  const draft: WorkoutDraft = {
    id: newId(),
    profileId: input.profileId,
    sessionName: input.sessionName,
    startedAt,
    exercises: uniqueUids(input.exercises ?? []),
  };
  if (input.programId !== undefined) draft.programId = input.programId;
  if (input.programSessionId !== undefined) draft.programSessionId = input.programSessionId;
  if (input.isDeload) draft.isDeload = true;
  if (input.notes !== undefined) draft.notes = input.notes;
  return draft;
}

/** Copies exercises and gives a fresh uid to any uid already used earlier in the list (or in `taken`). */
export function uniqueUids(exercises: readonly SessionExercise[], taken: Iterable<string> = []): SessionExercise[] {
  const seen = new Set(taken);
  return exercises.map((ex) => {
    const uid = ex.uid && !seen.has(ex.uid) ? ex.uid : newId();
    seen.add(uid);
    return { ...ex, uid, sets: ex.sets.map((s) => ({ ...s })) };
  });
}

function freshWorkingSets(count: number): SetEntry[] {
  return Array.from({ length: Math.max(1, count) }, () => ({ id: newId(), type: 'working' as const, kg: 0, reps: 0, done: false }));
}

/** Working sets of `ex` a swap should carry over: all of them, or only the undone ones once any set is done. */
export function remainingWorkingCount(ex: SessionExercise): number {
  const trained = ex.sets.some((s) => s.done);
  return ex.sets.filter((s) => s.type !== 'warmup' && !(trained && s.done)).length;
}

/** The new session exercise for `exercise`, reusing `uid`. */
function swappedEntry(old: SessionExercise, exercise: Exercise, uid: string, sets?: readonly SetEntry[]): SessionExercise {
  const workingCount = remainingWorkingCount(old);
  const out: SessionExercise = {
    uid,
    exerciseId: exercise.id,
    exerciseName: exercise.name,
    modality: exercise.modality,
    sets: sets && sets.length > 0 ? sets.map((s) => ({ ...s })) : freshWorkingSets(workingCount),
    muscleImpactSnapshot: exercise.impact.map((m) => ({ muscle: m.muscle, score: m.score })),
  };
  if (exercise.restSeconds !== undefined) out.restSeconds = exercise.restSeconds;
  if (old.supersetGroup !== undefined) out.supersetGroup = old.supersetGroup;
  return out;
}

export interface SwapResult {
  draft: WorkoutDraft | null;
  /** uid of the new exercise, or null when nothing changed. */
  uid: string | null;
  /** True when the old exercise had done sets and was kept (new one inserted after it). */
  inserted: boolean;
}

/**
 * Swap rule: a swap never discards logged work (the legacy app silently lost
 * done sets). If the old exercise has no done set it is replaced in place
 * (same uid and position; its notes are dropped). If any set is done, the old
 * exercise keeps only its done sets (the undone plan moves to the new
 * exercise) and the new one is inserted right after it with a fresh uid.
 * `sets` default: fresh empty working sets, as many as the old working sets
 * still to do (all of them for an in-place replace), at least one.
 */
export function swapInDraft(draft: WorkoutDraft | null, uid: string, exercise: Exercise, sets?: readonly SetEntry[]): SwapResult {
  if (!draft) return { draft, uid: null, inserted: false };
  const idx = draft.exercises.findIndex((e) => e.uid === uid);
  if (idx === -1) return { draft, uid: null, inserted: false };
  const old = draft.exercises[idx];
  const exercises = draft.exercises.slice();
  if (old.sets.some((s) => s.done)) {
    const entry = swappedEntry(old, exercise, newId(), sets);
    delete entry.supersetGroup;
    exercises[idx] = { ...old, sets: old.sets.filter((s) => s.done).map((s) => ({ ...s })) };
    exercises.splice(idx + 1, 0, entry);
    return { draft: { ...draft, exercises }, uid: entry.uid, inserted: true };
  }
  exercises[idx] = swappedEntry(old, exercise, old.uid, sets);
  return { draft: { ...draft, exercises }, uid: old.uid, inserted: false };
}

/** Inserts `warmups` (copied, forced to type 'warmup' and not done) before the first non-warm-up set. */
export function prependWarmupsTo(ex: SessionExercise, warmups: readonly SetEntry[]): SessionExercise {
  if (warmups.length === 0) return ex;
  const copies = warmups.map((w) => ({ ...w, type: 'warmup' as const, done: false, completedAt: undefined }));
  const at = ex.sets.findIndex((s) => s.type !== 'warmup');
  const cut = at === -1 ? ex.sets.length : at;
  return { ...ex, sets: [...ex.sets.slice(0, cut), ...copies, ...ex.sets.slice(cut)] };
}

/**
 * "Repeat workout" (G4-25): a new draft with the log's exercises in the log's
 * order. Fresh draft id, uids and set ids; every set is undone (no
 * `completedAt`, `rir`, `isPR`, `e1rm`); kg/reps/`durationSeconds` stay as the
 * prefill; a done working set's kg/reps become `ghostKg`/`ghostReps` ("beat
 * it"), other sets keep no ghost. Warm-ups stay warm-ups. Kept per exercise:
 * name, modality, rest, superset group, impact snapshot and `tempo` per set;
 * the exercise `notes` are dropped (they described that day). `sessionName`
 * comes from the log. NOT carried: `programId` / `programSessionId` (a repeat
 * is a quick workout and never advances a rotation), `isDeload`, the log notes.
 */
export function draftFromLog(profileId: string, log: WorkoutLog, startedAt: string): WorkoutDraft {
  const exercises = log.exercises.map((ex): SessionExercise => {
    const out: SessionExercise = {
      uid: newId(),
      exerciseId: ex.exerciseId,
      exerciseName: ex.exerciseName,
      modality: ex.modality,
      sets: ex.sets.map(repeatSet),
    };
    if (ex.restSeconds !== undefined) out.restSeconds = ex.restSeconds;
    if (ex.supersetGroup !== undefined) out.supersetGroup = ex.supersetGroup;
    if (ex.muscleImpactSnapshot) out.muscleImpactSnapshot = ex.muscleImpactSnapshot.map((m) => ({ ...m }));
    return out;
  });
  return makeDraft({ profileId, sessionName: log.sessionName, exercises }, startedAt);
}

function repeatSet(s: SetEntry): SetEntry {
  const out: SetEntry = { id: newId(), type: s.type, kg: s.kg, reps: s.reps, done: false };
  if (s.tempo !== undefined) out.tempo = s.tempo;
  if (s.durationSeconds !== undefined) out.durationSeconds = s.durationSeconds;
  if (s.done && s.type !== 'warmup' && s.durationSeconds === undefined) {
    out.ghostKg = s.kg;
    out.ghostReps = s.reps;
  }
  return out;
}

/**
 * The draft with its exercises in `uids` order. `uids` must be an exact
 * permutation of the draft's uids (same size, no duplicates, none unknown or
 * missing); anything else returns the input unchanged.
 */
export function reorderByUids(draft: WorkoutDraft | null, uids: readonly string[]): WorkoutDraft | null {
  if (!draft || uids.length !== draft.exercises.length) return draft;
  const byUid = new Map(draft.exercises.map((e) => [e.uid, e]));
  if (new Set(uids).size !== uids.length || uids.some((u) => !byUid.has(u))) return draft;
  if (uids.every((u, i) => draft.exercises[i].uid === u)) return draft;
  return { ...draft, exercises: uids.map((u) => byUid.get(u) as SessionExercise) };
}
