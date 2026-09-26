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
 * Hardening: the persisted draft is repaired, not dropped, when one row is
 * bad (`sanitizeDraft`, ./draft-validation.ts); another tab's write re-reads
 * it (`syncAcrossTabs`, ./cross-tab.ts); `toggleSetDone` needs kg > 0 unless
 * the exercise is bodyweight (same rule as set-rules `canCompleteSet`).
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
 *
 * Wave 2:
 * - Time sets (`measure.ts`): `updateSet` accepts `durationSeconds` (whole,
 *   non-negative seconds). A done set stays done while the set itself holds
 *   work: seconds > 0, or reps (+ kg unless bodyweight). The `measure`
 *   argument is accepted for callers but never erases work logged in the other
 *   dimension; a done time set an edit leaves at 0 s is no longer done. `toggleTimeSetDone(uid, setId, ghost?)` marks a time set done with
 *   its seconds, or — empty — by adopting the ghost (reps/kg ignored);
 *   `toggleSetDone` stays the reps rule. `addSet` after a time set copies no
 *   duration: the previous hold becomes the new set's `ghostDurationSeconds`.
 * - Hold timers (refuter-2 F2): `removeSet`, `removeExercise` and `discard`
 *   clear the stored starts of the sets they drop (`clearHoldStarts`, ./hold-storage.ts).
 * - `startFromLog(profileId, log, measureOf?)` → WorkoutDraft | null: "repeat
 *   workout" (G4-25); rules in `draftFromLog` (./draft-ops.ts). Returns null and
 *   changes nothing while a draft is in progress; to replace one, `discard()`
 *   first (the orchestrator's `repeatLog({ replace: true })` does). Unlike
 *   G4-25's proposal, `programId`/`programSessionId` are dropped: a repeat is a
 *   quick workout and never advances the program rotation.
 * - `reorderExercises(uids)` → applies an exact permutation of the draft's
 *   uids; anything else is a no-op.
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
  ExerciseMeasure,
  SetEntry,
  WorkoutDraft,
  WorkoutLog,
} from '@/contracts/domain';
import { useRestTimerStore } from './rest-timer-store';
import { draftFromLog, makeDraft, prependWarmupsTo, reorderByUids, swapInDraft, uniqueUids, type StartDraftInput } from './draft-ops';
import { syncAcrossTabs } from './cross-tab';
import { sanitizeDraft } from './draft-validation';
import { cleanSeconds } from './measure';
import { clearHoldStarts } from './hold-storage';

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
  /** `measure` decides the done rule for an edit (see the file header). */
  updateSet(uid: string, setId: string, patch: SetPatch, measure?: ExerciseMeasure): void;
  removeSet(uid: string, setId: string): void;
  /** Flips `done`; stamps `completedAt` when it becomes done, clears it otherwise. */
  toggleSetDone(uid: string, setId: string): void;
  /**
   * Time sets: flips `done`. An empty duration adopts the set's
   * `ghostDurationSeconds`, else `ghostSeconds` (the card's last-session hint);
   * with neither it stays not done.
   */
  toggleTimeSetDone(uid: string, setId: string, ghostSeconds?: number): void;
  /** Repeat workout: a new draft from a history log (see `draftFromLog`); null (no change) while a draft is in progress. */
  startFromLog(profileId: string, log: WorkoutLog, measureOf?: (exerciseId: string) => ExerciseMeasure | undefined): WorkoutDraft | null;
  /** Reorders the draft to `uids` when it is an exact permutation of its uids; otherwise no-op. */
  reorderExercises(uids: readonly string[]): void;
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

function modalityOf(draft: WorkoutDraft | null, uid: string): SessionExercise['modality'] | undefined {
  return draft?.exercises.find((e) => e.uid === uid)?.modality;
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

// ─── Persisted-shape validation: ./draft-validation.ts (strict predicate + repair) ─

export { isWorkoutDraft } from './draft-validation';

function draftFromPersisted(persisted: unknown): WorkoutDraft | null {
  if (typeof persisted !== 'object' || persisted === null) return null;
  const draft = (persisted as Record<string, unknown>).draft;
  return draft === null || draft === undefined ? null : sanitizeDraft(draft, nowIso());
}

// ─── Store ───────────────────────────────────────────────────────────────────

export const useWorkoutStore = create<WorkoutStore>()(
  persist(
    (set, get) => ({
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
        set((s) => {
          if (!s.draft) return s;
          clearHoldStarts(s.draft.exercises.filter((e) => e.uid === uid).flatMap((e) => e.sets.map((x) => x.id)));
          return { draft: { ...s.draft, exercises: s.draft.exercises.filter((e) => e.uid !== uid) } };
        }),

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
            const next = emptyWorkingSet(last?.kg ?? 0);
            // Time sets (refuter-2 F1): the previous hold is only the placeholder hint, never a value.
            const hint = cleanSeconds(last?.durationSeconds) || cleanSeconds(last?.ghostDurationSeconds);
            if (hint > 0) next.ghostDurationSeconds = hint;
            return { ...ex, sets: [...ex.sets, next] };
          }),
        })),

      updateSet: (uid, setId, patch) =>
        set((s) => ({
          draft: withExercise(s.draft, uid, (ex) => {
            if (!ex.sets.some((x) => x.id === setId)) return ex;
            const sets = ex.sets.map((entry) => {
              if (entry.id !== setId) return entry;
              const next = { ...entry, ...patch, id: entry.id };
              if ('durationSeconds' in patch) next.durationSeconds = cleanSeconds(patch.durationSeconds);
              // A done set stays done while the SET still holds work in either dimension (refuter-2 F4):
              // seconds > 0, or reps with a weight (unless bodyweight). The measure only picks the inputs
              // shown; a wrong or not-yet-loaded measure never erases work logged in the other dimension.
              // So a done time set cleared to 0 s, or a rep set cleared to 0 reps, is no longer done.
              const complete = cleanSeconds(next.durationSeconds) > 0 || (next.reps > 0 && (next.kg > 0 || ex.modality === 'bodyweight'));
              return next.done && !complete ? { ...next, done: false, completedAt: undefined } : next;
            });
            return { ...ex, sets };
          }),
        })),

      removeSet: (uid, setId) =>
        set((s) => {
          clearHoldStarts([setId]);
          return {
            draft: withExercise(s.draft, uid, (ex) => ({ ...ex, sets: ex.sets.filter((x) => x.id !== setId) })),
          };
        }),

      toggleSetDone: (uid, setId) =>
        set((s) => ({
          draft: withSet(s.draft, uid, setId, (entry) => {
            if (entry.done) return { ...entry, done: false, completedAt: undefined };
            // Empty reps adopt last session's ghost reps; with neither, a set cannot be done.
            // Mirrors set-rules `canCompleteSet`: a weight is needed unless bodyweight (F5).
            const reps = entry.reps > 0 ? entry.reps : Math.round(entry.ghostReps ?? 0);
            if (reps <= 0) return entry;
            if (!(entry.kg > 0) && modalityOf(s.draft, uid) !== 'bodyweight') return entry;
            return { ...entry, reps, done: true, completedAt: nowIso() };
          }),
        })),

      toggleTimeSetDone: (uid, setId, ghostSeconds) =>
        set((s) => ({
          draft: withSet(s.draft, uid, setId, (entry) => {
            if (entry.done) return { ...entry, done: false, completedAt: undefined };
            // Empty duration adopts the ghost (explicit tap/Enter, the ghost-reps rule); neither → not done.
            const seconds = cleanSeconds(entry.durationSeconds) || cleanSeconds(entry.ghostDurationSeconds) || cleanSeconds(ghostSeconds);
            if (seconds <= 0) return entry;
            return { ...entry, durationSeconds: seconds, done: true, completedAt: nowIso() };
          }),
        })),

      startFromLog: (profileId, log, measureOf) => {
        if (get().draft) return null; // G4-25: never overwrite a workout in progress
        const draft = draftFromLog(profileId, log, nowIso(), measureOf);
        useRestTimerStore.getState().stop();
        set({ draft });
        return draft;
      },

      reorderExercises: (uids) =>
        set((s) => {
          const draft = reorderByUids(s.draft, uids);
          return draft === s.draft ? s : { draft };
        }),

      setNotes: (notes) => set((s) => (s.draft ? { draft: { ...s.draft, notes } } : s)),

      discard: () => {
        // A rest belongs to its workout: never carry it into the next one.
        useRestTimerStore.getState().stop();
        clearHoldStarts(); // refuter-2 F2: no hold outlives its workout (finish ends with discard too)
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

// Another tab's write (or this tab becoming visible again) re-reads the draft (F1).
syncAcrossTabs(WORKOUT_DRAFT_STORAGE_KEY, () => useWorkoutStore.persist.rehydrate());

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
