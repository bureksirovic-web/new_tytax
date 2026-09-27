'use client';
/**
 * `useWorkout()` — React orchestration of the workout loop (G3).
 *
 * Returns `UseWorkoutResult`:
 * - `ready`: active profile loaded AND the persisted draft hydrated. Do not
 *   redirect on `draft === null` before this is true.
 * - `profile`, `profileId`, `settings` (defaults merged), `draft`.
 * - `activeProgram` (live), `nextSession`: `{ index, session, isRest }` for the
 *   rotation pointer (`program.currentSessionIndex`, wrapped), or null.
 * - `startQuick(sessionName)` → WorkoutDraft | null (null without a profile).
 * - `prepareProgramStart()` → `{ offers: { deload?, weakPoint? } } | null`
 *   (null: no program or a rest session). Show the offers, then call
 * - `startProgram({ deload, weakPoint })` → WorkoutDraft | null; uses the plan
 *   from the last `prepareProgramStart` (prepares again when there is none).
 * - `addExercise(exercise)` / `swapExercise(uid, exercise)` → Promise<uid | null>
 *   (prefilled via `buildSessionExercise` from `repo.logs.historyFor`).
 * - `finish(debrief)` → Promise<FinishResult>; the caller calls
 *   `useWorkoutStore.getState().discard()` after deciding where to navigate.
 * - `skipRestDay()` → advances the active program past a rest session.
 * - `foreignDraft`: the persisted draft was started by another profile (after a
 *   profile switch). Add/swap return null and `finish` throws
 *   `ForeignDraftError` for it; show `draftOwner` with `switchToDraftOwner()`
 *   (null owner: that profile was deleted, so only discarding is possible).
 *
 * Wave 2:
 * - `orderByStation()` → Promise<boolean>: reorders the draft by TYTAX station
 *   (G1's @/lib/workout/order-by-station); false when nothing changed.
 * - `repeatLog(log, { replace? })` → WorkoutDraft | null: "repeat workout"
 *   (`startFromLog`, a quick workout, no program). Null without a profile, for
 *   a log of another profile or in the trash, or while a draft exists unless `replace: true`
 *   (ask the user first).
 * - `measureOfExercise(exerciseId)` → 'reps' | 'time': `measureOf` over the
 *   catalog (loaded once a draft exists, retried on online/visibility after a
 *   failure); until then, or for an id the catalog does not know, 'time' when
 *   a catalog seen on this device tagged it so (stores/measure-cache), or when a draft set of that exercise carries
 *   `durationSeconds` or `ghostDurationSeconds` (a prefilled hold has only the ghost).
 * - `lastDurations(exerciseId)` → Promise of last session's working-set
 *   seconds by working index (undefined: not done / no seconds), from
 *   `repo.logs.historyFor`; [] without a profile. Feeds the time-set ghost.
 * - `setup`: `{ canSave, load(exerciseId), save(exerciseId, setup) }` over
 *   src/stores/setup-adapter.ts for the active profile. Without a profile,
 *   `load` → undefined and `save` → `{ saved: false, reason: 'unsupported' }`.
 *   `canSave` false: show the setup read-only (the repo cannot write it yet).
 *
 * Tests: mock `getRepository` from '@/lib/db' (see src/hooks/__tests__), or use
 * `createWorkoutOrchestrator` from '@/stores/workout-orchestrator' directly.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  Exercise,
  ExerciseMeasure,
  MachineSetup,
  Profile,
  ProfileSettings,
  Program,
  ProgramSession,
  WorkoutDebrief,
  WorkoutDraft,
  WorkoutLog,
} from '@/contracts/domain';
import type { Catalog } from '@/contracts/exercise-catalog';
import type { FinishResult } from '@/contracts/repo';
import { useActiveProfile, useRepo, useRepoQuery } from '@/hooks/use-repo';
import { measureOf } from '@/stores/measure';
import { cachedMeasure, loadCatalogRemembering } from '@/stores/measure-cache';
import { lastDurations as lastDurationsOf } from '@/stores/session-exercise';
import { wrapIndex } from '@/stores/session-builder';
import { canSaveSetup, loadSetup, saveSetup, type SaveSetupResult } from '@/stores/setup-adapter';
import {
  createWorkoutOrchestrator,
  isForeignDraft,
  settingsOf,
  type PreparedProgramStart,
  type ProgramStartChoice,
  type ProgramStartOffers,
} from '@/stores/workout-orchestrator';
import { useWorkoutHydrated, useWorkoutStore } from '@/stores/workout-store';

export interface NextSession {
  index: number;
  session: ProgramSession;
  isRest: boolean;
}

export interface WorkoutSetupApi {
  /** False: the repository cannot store a setup yet; show it read-only. */
  canSave: boolean;
  load(exerciseId: string): Promise<MachineSetup | undefined>;
  save(exerciseId: string, setup: MachineSetup | undefined): Promise<SaveSetupResult>;
}

export interface UseWorkoutResult {
  ready: boolean;
  profile: Profile | undefined;
  profileId: string | undefined;
  settings: ProfileSettings;
  draft: WorkoutDraft | null;
  activeProgram: Program | undefined;
  /** True until the active-program query resolved (undefined `activeProgram` then means none). */
  activeProgramLoading: boolean;
  nextSession: NextSession | null;
  startQuick(sessionName: string): WorkoutDraft | null;
  prepareProgramStart(): Promise<{ offers: ProgramStartOffers } | null>;
  startProgram(choice: ProgramStartChoice): Promise<WorkoutDraft | null>;
  addExercise(exercise: Exercise): Promise<string | null>;
  swapExercise(uid: string, exercise: Exercise): Promise<string | null>;
  finish(debrief?: WorkoutDebrief): Promise<FinishResult>;
  skipRestDay(): Promise<Program | null>;
  foreignDraft: boolean;
  /** Owner of a foreign draft: undefined while loading or when not foreign, null when it no longer exists. */
  draftOwner: Profile | null | undefined;
  switchToDraftOwner(): Promise<void>;
  orderByStation(): Promise<boolean>;
  repeatLog(log: WorkoutLog, opts?: { replace?: boolean }): WorkoutDraft | null;
  measureOfExercise(exerciseId: string): ExerciseMeasure;
  lastDurations(exerciseId: string): Promise<Array<number | undefined>>;
  setup: WorkoutSetupApi;
}

export function nextSessionOf(program: Program | undefined): NextSession | null {
  if (!program || program.sessions.length === 0) return null;
  const index = wrapIndex(program.currentSessionIndex, program.sessions.length);
  const session = program.sessions[index];
  return { index, session, isRest: session.isRest === true || session.exercises.length === 0 };
}

export function useWorkout(): UseWorkoutResult {
  const repo = useRepo();
  const { profile, profileId, loading } = useActiveProfile();
  const hydrated = useWorkoutHydrated();
  const draft = useWorkoutStore((s) => s.draft);
  const { data: activeProgram, loading: programLoading } = useRepoQuery(
    (r) => (profileId ? r.programs.getActive(profileId) : Promise.resolve(undefined)),
    [profileId],
  );
  const orch = useMemo(() => createWorkoutOrchestrator({ repo, loadCatalog: loadCatalogRemembering }), [repo]);
  const planRef = useRef<PreparedProgramStart | null>(null);
  const ready = !loading && hydrated;
  const foreignDraft = ready && isForeignDraft(draft, profileId ?? null);
  const ownerId = foreignDraft ? draft?.profileId : undefined;
  const { data: owner } = useRepoQuery(
    async (r) => (ownerId ? ((await r.profiles.get(ownerId)) ?? null) : undefined),
    [ownerId],
  );

  const prepareProgramStart = useCallback(async () => {
    if (!profileId) return null;
    const plan = await orch.prepareProgramStart(profileId);
    planRef.current = plan;
    return plan ? { offers: plan.offers } : null;
  }, [orch, profileId]);

  const startProgram = useCallback(
    async (choice: ProgramStartChoice) => {
      if (!profileId) return null;
      const plan =
        planRef.current?.profileId === profileId ? planRef.current : await orch.prepareProgramStart(profileId);
      planRef.current = null;
      return plan ? orch.startProgram(plan, choice) : null;
    },
    [orch, profileId],
  );

  const startQuick = useCallback(
    (sessionName: string) => (profileId ? orch.startQuick(profileId, sessionName) : null),
    [orch, profileId],
  );
  const addExercise = useCallback(
    async (exercise: Exercise) => (profileId ? orch.addExercise(profileId, exercise) : null),
    [orch, profileId],
  );
  const swapExercise = useCallback(
    async (uid: string, exercise: Exercise) => (profileId ? orch.swapExercise(profileId, uid, exercise) : null),
    [orch, profileId],
  );
  const skipRestDay = useCallback(
    async () => (profileId ? orch.skipRestDay(profileId) : null),
    [orch, profileId],
  );

  const finish = useCallback(
    (debrief?: WorkoutDebrief) => orch.finish(debrief, profileId ?? null),
    [orch, profileId],
  );
  const switchToDraftOwner = useCallback(async () => {
    if (ownerId) await repo.profiles.setActive(ownerId);
  }, [repo, ownerId]);

  const hasDraft = draft !== null;
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  // A failed load (offline, stale chunk) is retried when the device comes back
  // online or the page becomes visible again; `measureOfExercise` falls back
  // to the device's cached time ids meanwhile (./measure-cache).
  const [catalogAttempt, setCatalogAttempt] = useState(0);
  useEffect(() => {
    if (!hasDraft || catalog) return;
    let live = true;
    let unlisten = (): void => undefined;
    loadCatalogRemembering().then(
      (c) => {
        if (live) setCatalog(c);
      },
      () => {
        if (!live) return;
        const retry = (): void => {
          if (document.visibilityState !== 'hidden') setCatalogAttempt((n) => n + 1);
        };
        window.addEventListener('online', retry);
        document.addEventListener('visibilitychange', retry);
        unlisten = () => {
          window.removeEventListener('online', retry);
          document.removeEventListener('visibilitychange', retry);
        };
      },
    );
    return () => {
      live = false;
      unlisten();
    };
  }, [hasDraft, catalog, catalogAttempt]);

  const orderByStation = useCallback(
    async () => (profileId ? orch.orderByStation(profileId) : false),
    [orch, profileId],
  );
  const repeatLog = useCallback(
    (log: WorkoutLog, opts?: { replace?: boolean }) => {
      if (!profileId) return null;
      // Catalog measure when loaded; else draftFromLog falls back to sets carrying durationSeconds.
      const lookup = catalog ? (id: string) => { const e = catalog.getById(id); return e ? measureOf(e) : undefined; } : undefined;
      const res = orch.repeatLog(profileId, log, { ...opts, measureOf: lookup });
      return res.ok ? res.draft : null;
    },
    [orch, profileId, catalog],
  );
  const measureOfExercise = useCallback(
    (exerciseId: string): ExerciseMeasure => {
      const known = catalog?.getById(exerciseId);
      if (known) return measureOf(known);
      if (cachedMeasure(exerciseId) === 'time') return 'time';
      const timed = draft?.exercises.some(
        (e) => e.exerciseId === exerciseId && e.sets.some((x) => typeof x.durationSeconds === 'number' || typeof x.ghostDurationSeconds === 'number'),
      );
      return timed ? 'time' : 'reps';
    },
    [catalog, draft],
  );
  const lastDurations = useCallback(
    async (exerciseId: string) =>
      profileId ? lastDurationsOf(exerciseId, await repo.logs.historyFor(profileId, exerciseId)) : [],
    [repo, profileId],
  );
  const setup = useMemo<WorkoutSetupApi>(
    () => ({
      canSave: canSaveSetup(repo),
      load: async (exerciseId) => (profileId ? loadSetup(repo, profileId, exerciseId) : undefined),
      save: async (exerciseId, value) =>
        profileId ? saveSetup(repo, profileId, exerciseId, value) : { saved: false, reason: 'unsupported' },
    }),
    [repo, profileId],
  );

  const settings = useMemo(() => settingsOf(profile), [profile]);
  const nextSession = useMemo(() => nextSessionOf(activeProgram), [activeProgram]);

  return {
    ready,
    profile,
    profileId,
    settings,
    draft,
    activeProgram,
    activeProgramLoading: programLoading,
    nextSession,
    startQuick,
    prepareProgramStart,
    startProgram,
    addExercise,
    swapExercise,
    finish,
    skipRestDay,
    foreignDraft,
    draftOwner: foreignDraft ? owner : undefined,
    switchToDraftOwner,
    orderByStation,
    repeatLog,
    measureOfExercise,
    lastDurations,
    setup,
  };
}
