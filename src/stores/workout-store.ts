/**
 * Persisted workout draft (TYTAX v2).
 *
 * Pure state only: no Dexie and no repository calls. Finishing a workout is
 * `getRepository().finishWorkout(draft, debrief)` followed by `discard()`.
 *
 * The draft is persisted to localStorage under `tytax.workout-draft.v3` so an
 * in-progress workout survives a reload. Hydration is manual
 * (`skipHydration`): pages call `useWorkoutHydrated()` and must not act on
 * `draft === null` until it returns true.
 *
 * G3 actions (pure immutable updates, helpers in ./draft-ops.ts):
 * - `startDraft(input: StartDraftInput): WorkoutDraft` — start from prepared
 *   exercises (program start, deload, weak point); replaces any draft.
 * - `swapExercise(uid, exercise, sets?): string | null` — replaces the exercise
 *   in place (same uid) when none of its sets is done; otherwise keeps it and
 *   INSERTS the new exercise after it, returning the new uid (logged work is
 *   never discarded). `sets` default: fresh empty working sets. Null when
 *   there is no draft or the uid is unknown.
 * - `addPreparedExercise(se): string | null` — appends a built SessionExercise
 *   (e.g. from `buildSessionExercise`); a uid already in the draft is replaced
 *   by a fresh one. Returns the uid used.
 * - `prependWarmups(uid, warmups)` — inserts warm-ups before the first
 *   non-warm-up set.
 * - `replaceExercises(exercises, opts?: { isDeload?: boolean })` — replaces the
 *   whole exercise list; `isDeload` true marks the draft, false clears it.
 */
import { useEffect, useSyncExternalStore } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { newUuid } from '@/lib/db/ids';
import type {
  Exercise,
  Program,
  ProgramExercise,
  SessionExercise,
  SetEntry,
  WorkoutDraft,
} from '@/contracts/domain';
import { useRestTimerStore } from './rest-timer-store';
import { makeDraft, prependWarmupsTo, swapInDraft, uniqueUids, type StartDraftInput } from './draft-ops';

export type { StartDraftInput } from './draft-ops';

export const WORKOUT_DRAFT_STORAGE_KEY = 'tytax.workout-draft.v3';
export const WORKOUT_DRAFT_VERSION = 3;

/** Most sets `addExercise` creates for a new exercise. */
const MAX_INITIAL_SETS = 3;

export type SetPatch = Partial<Omit<SetEntry, 'id'>>;

/** Returns the working sets for one program slot (e.g. from `training.prefillFromHistory`). */
export type ProgramPrefill = (exerciseId: string, slot: ProgramExercise) => SetEntry[];

export interface StartFromProgramOptions {
  prefill?: ProgramPrefill;
}

export interface WorkoutState {
  draft: WorkoutDraft | null;
}

export interface WorkoutActions {
  /** Starts an empty workout, replacing any current draft. */
  startQuick(profileId: string, sessionName: string): WorkoutDraft;
  /**
   * Starts the program session at `sessionIndex` (wrapped into range).
   * Returns null and leaves the draft untouched for a rest session or a
   * program without sessions.
   */
  startFromProgram(
    profileId: string,
    program: Program,
    sessionIndex: number,
    opts?: StartFromProgramOptions,
  ): WorkoutDraft | null;
  /** Appends the exercise with a fresh uid; returns the uid, or null without a draft. */
  addExercise(ex: Exercise): string | null;
  removeExercise(uid: string): void;
  moveExercise(uid: string, direction: -1 | 1): void;
  /** Appends a working set that copies the last set's kg, reps 0. */
  addSet(uid: string): void;
  updateSet(uid: string, setId: string, patch: SetPatch): void;
  removeSet(uid: string, setId: string): void;
  /** Flips `done`; stamps `completedAt` when it becomes done, clears it otherwise. */
  toggleSetDone(uid: string, setId: string): void;
  setNotes(notes: string): void;
  /** Drops the draft and stops the rest timer. */
  discard(): void;
  /** Starts a draft from prepared exercises, replacing any current draft. */
  startDraft(input: StartDraftInput): WorkoutDraft;
  /** See the file header: replace in place, or insert after when sets are done. */
  swapExercise(uid: string, exercise: Exercise, sets?: SetEntry[]): string | null;
  /** Appends a fully built exercise; returns its (possibly re-issued) uid, or null without a draft. */
  addPreparedExercise(se: SessionExercise): string | null;
  /** Inserts warm-up sets before the first non-warm-up set. */
  prependWarmups(uid: string, warmups: SetEntry[]): void;
  /** Replaces every exercise (deload / injector); `isDeload` sets or clears the flag. */
  replaceExercises(exercises: SessionExercise[], opts?: { isDeload?: boolean }): void;
}

export type WorkoutStore = WorkoutState & WorkoutActions;

// ─── Pure helpers ────────────────────────────────────────────────────────────

const newId = newUuid;
const nowIso = (): string => new Date().toISOString();

export function emptyWorkingSet(kg = 0): SetEntry {
  return { id: newId(), type: 'working', kg, reps: 0, done: false };
}

function emptyWorkingSets(count: number): SetEntry[] {
  return Array.from({ length: count }, () => emptyWorkingSet());
}

function sessionExerciseFromSlot(slot: ProgramExercise, prefill?: ProgramPrefill): SessionExercise {
  const slotSets = slot.sets > 0 ? Math.floor(slot.sets) : 1;
  const prefilled = prefill ? prefill(slot.exerciseId, slot) : [];
  const sets =
    prefilled.length > 0
      ? prefilled.map((s) => ({ ...s, id: newId(), done: false, completedAt: undefined }))
      : emptyWorkingSets(slotSets);
  const ex: SessionExercise = {
    uid: newId(),
    exerciseId: slot.exerciseId,
    exerciseName: slot.exerciseName,
    modality: slot.modality,
    sets,
  };
  if (slot.restSeconds !== undefined) ex.restSeconds = slot.restSeconds;
  if (slot.supersetGroup !== undefined) ex.supersetGroup = slot.supersetGroup;
  return ex;
}

function sessionExerciseFromCatalog(ex: Exercise): SessionExercise {
  const count = Math.min(ex.defaultSets || MAX_INITIAL_SETS, MAX_INITIAL_SETS);
  const out: SessionExercise = {
    uid: newId(),
    exerciseId: ex.id,
    exerciseName: ex.name,
    modality: ex.modality,
    sets: emptyWorkingSets(count),
    muscleImpactSnapshot: ex.impact.map((m) => ({ muscle: m.muscle, score: m.score })),
  };
  if (ex.restSeconds !== undefined) out.restSeconds = ex.restSeconds;
  return out;
}

function withExercise(
  draft: WorkoutDraft | null,
  uid: string,
  fn: (ex: SessionExercise) => SessionExercise,
): WorkoutDraft | null {
  if (!draft) return draft;
  const idx = draft.exercises.findIndex((e) => e.uid === uid);
  if (idx === -1) return draft;
  const exercises = draft.exercises.slice();
  exercises[idx] = fn(exercises[idx]);
  return { ...draft, exercises };
}

function withSet(
  draft: WorkoutDraft | null,
  uid: string,
  setId: string,
  fn: (s: SetEntry) => SetEntry,
): WorkoutDraft | null {
  return withExercise(draft, uid, (ex) => {
    if (!ex.sets.some((s) => s.id === setId)) return ex;
    return { ...ex, sets: ex.sets.map((s) => (s.id === setId ? fn(s) : s)) };
  });
}

// ─── Persisted-shape validation (localStorage is untrusted input) ────────────

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isSetEntry(v: unknown): v is SetEntry {
  return (
    isRecord(v) &&
    typeof v.id === 'string' &&
    typeof v.type === 'string' &&
    typeof v.kg === 'number' &&
    typeof v.reps === 'number' &&
    typeof v.done === 'boolean'
  );
}

function isSessionExercise(v: unknown): v is SessionExercise {
  return (
    isRecord(v) &&
    typeof v.uid === 'string' &&
    typeof v.exerciseId === 'string' &&
    typeof v.exerciseName === 'string' &&
    typeof v.modality === 'string' &&
    Array.isArray(v.sets) &&
    v.sets.every(isSetEntry)
  );
}

export function isWorkoutDraft(v: unknown): v is WorkoutDraft {
  return (
    isRecord(v) &&
    typeof v.id === 'string' &&
    typeof v.profileId === 'string' &&
    typeof v.sessionName === 'string' &&
    typeof v.startedAt === 'string' &&
    Array.isArray(v.exercises) &&
    v.exercises.every(isSessionExercise)
  );
}

function draftFromPersisted(persisted: unknown): WorkoutDraft | null {
  if (!isRecord(persisted)) return null;
  return isWorkoutDraft(persisted.draft) ? persisted.draft : null;
}

// ─── Store ───────────────────────────────────────────────────────────────────

export const useWorkoutStore = create<WorkoutStore>()(
  persist(
    (set) => ({
      draft: null,

      startQuick: (profileId, sessionName) => {
        const draft: WorkoutDraft = {
          id: newId(),
          profileId,
          sessionName,
          startedAt: nowIso(),
          exercises: [],
        };
        set({ draft });
        return draft;
      },

      startFromProgram: (profileId, program, sessionIndex, opts) => {
        const count = program.sessions.length;
        if (count === 0) return null;
        const idx = ((Math.floor(sessionIndex) % count) + count) % count;
        const session = program.sessions[idx];
        if (!session || session.isRest) return null;
        const draft: WorkoutDraft = {
          id: newId(),
          profileId,
          programId: program.id,
          programSessionId: session.id,
          sessionName: session.name,
          startedAt: nowIso(),
          exercises: session.exercises.map((slot) => sessionExerciseFromSlot(slot, opts?.prefill)),
        };
        set({ draft });
        return draft;
      },

      addExercise: (ex) => {
        const entry = sessionExerciseFromCatalog(ex);
        let added: string | null = null;
        set((s) => {
          if (!s.draft) return s;
          added = entry.uid;
          return { draft: { ...s.draft, exercises: [...s.draft.exercises, entry] } };
        });
        return added;
      },

      removeExercise: (uid) =>
        set((s) =>
          s.draft ? { draft: { ...s.draft, exercises: s.draft.exercises.filter((e) => e.uid !== uid) } } : s,
        ),

      moveExercise: (uid, direction) =>
        set((s) => {
          if (!s.draft) return s;
          const from = s.draft.exercises.findIndex((e) => e.uid === uid);
          const to = from + direction;
          if (from === -1 || to < 0 || to >= s.draft.exercises.length) return s;
          const exercises = s.draft.exercises.slice();
          [exercises[from], exercises[to]] = [exercises[to], exercises[from]];
          return { draft: { ...s.draft, exercises } };
        }),

      addSet: (uid) =>
        set((s) => ({
          draft: withExercise(s.draft, uid, (ex) => {
            const last = ex.sets[ex.sets.length - 1];
            return { ...ex, sets: [...ex.sets, emptyWorkingSet(last?.kg ?? 0)] };
          }),
        })),

      updateSet: (uid, setId, patch) =>
        set((s) => ({
          draft: withExercise(s.draft, uid, (ex) => {
            if (!ex.sets.some((x) => x.id === setId)) return ex;
            const sets = ex.sets.map((entry) => {
              if (entry.id !== setId) return entry;
              const next = { ...entry, ...patch, id: entry.id };
              // A done set that an edit leaves without reps (or weight, unless bodyweight) is no longer done.
              const complete = next.reps > 0 && (next.kg > 0 || ex.modality === 'bodyweight');
              return next.done && !complete ? { ...next, done: false, completedAt: undefined } : next;
            });
            return { ...ex, sets };
          }),
        })),

      removeSet: (uid, setId) =>
        set((s) => ({
          draft: withExercise(s.draft, uid, (ex) => ({ ...ex, sets: ex.sets.filter((x) => x.id !== setId) })),
        })),

      toggleSetDone: (uid, setId) =>
        set((s) => ({
          draft: withSet(s.draft, uid, setId, (entry) => {
            if (entry.done) return { ...entry, done: false, completedAt: undefined };
            // Empty reps adopt last session's ghost reps; with neither, a set cannot be done.
            const reps = entry.reps > 0 ? entry.reps : Math.round(entry.ghostReps ?? 0);
            if (reps <= 0) return entry;
            return { ...entry, reps, done: true, completedAt: nowIso() };
          }),
        })),

      setNotes: (notes) => set((s) => (s.draft ? { draft: { ...s.draft, notes } } : s)),

      discard: () => {
        // A rest belongs to its workout: never carry it into the next one.
        useRestTimerStore.getState().stop();
        set({ draft: null });
      },

      startDraft: (input) => {
        const draft = makeDraft(input, nowIso());
        set({ draft });
        return draft;
      },

      swapExercise: (uid, exercise, sets) => {
        let out: string | null = null;
        set((s) => {
          const res = swapInDraft(s.draft, uid, exercise, sets);
          out = res.uid;
          return res.uid ? { draft: res.draft } : s;
        });
        return out;
      },

      addPreparedExercise: (se) => {
        let out: string | null = null;
        set((s) => {
          if (!s.draft) return s;
          const [entry] = uniqueUids([se], s.draft.exercises.map((e) => e.uid));
          out = entry.uid;
          return { draft: { ...s.draft, exercises: [...s.draft.exercises, entry] } };
        });
        return out;
      },

      prependWarmups: (uid, warmups) =>
        set((s) => ({ draft: withExercise(s.draft, uid, (ex) => prependWarmupsTo(ex, warmups)) })),

      replaceExercises: (exercises, opts) =>
        set((s) => {
          if (!s.draft) return s;
          const draft: WorkoutDraft = { ...s.draft, exercises: uniqueUids(exercises) };
          if (opts?.isDeload === true) draft.isDeload = true;
          if (opts?.isDeload === false) delete draft.isDeload;
          return { draft };
        }),
    }),
    {
      name: WORKOUT_DRAFT_STORAGE_KEY,
      version: WORKOUT_DRAFT_VERSION,
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (s) => ({ draft: s.draft }),
      // Older shapes (the unpersisted v2 store) have nothing worth keeping.
      migrate: (persisted) => ({ draft: draftFromPersisted(persisted) }),
      merge: (persisted, current) => ({ ...current, draft: draftFromPersisted(persisted) }),
    },
  ),
);

// ─── Hydration ───────────────────────────────────────────────────────────────

function subscribeHydration(onChange: () => void): () => void {
  const offStart = useWorkoutStore.persist.onHydrate(onChange);
  const offFinish = useWorkoutStore.persist.onFinishHydration(onChange);
  return () => {
    offStart();
    offFinish();
  };
}

const getHydrated = (): boolean => useWorkoutStore.persist.hasHydrated();
const getServerHydrated = (): boolean => false;

/**
 * Rehydrates the persisted draft once on mount and returns true once it has
 * been read. Until then `draft` is null for reasons that mean nothing, so
 * callers must not redirect on it.
 */
export function useWorkoutHydrated(): boolean {
  const hydrated = useSyncExternalStore(subscribeHydration, getHydrated, getServerHydrated);
  useEffect(() => {
    if (!useWorkoutStore.persist.hasHydrated()) {
      void useWorkoutStore.persist.rehydrate();
    }
  }, []);
  return hydrated;
}
