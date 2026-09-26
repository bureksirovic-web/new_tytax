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
 * Tests: mock `getRepository` from '@/lib/db' (see src/hooks/__tests__), or use
 * `createWorkoutOrchestrator` from '@/stores/workout-orchestrator' directly.
 */
import { useCallback, useMemo, useRef } from 'react';
import type { Exercise, Profile, ProfileSettings, Program, ProgramSession, WorkoutDebrief, WorkoutDraft } from '@/contracts/domain';
import type { FinishResult } from '@/contracts/repo';
import { useActiveProfile, useRepo, useRepoQuery } from '@/hooks/use-repo';
import { loadCatalog } from '@/lib/catalog';
import { wrapIndex } from '@/stores/session-builder';
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
  const orch = useMemo(() => createWorkoutOrchestrator({ repo, loadCatalog: () => loadCatalog() }), [repo]);
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
  };
}
