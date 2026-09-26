/**
 * Workout orchestration over the repository, the lazy catalog and the
 * workout store (no React). `useWorkout` (src/hooks/use-workout.ts) binds it
 * to the app singletons; tests inject a repository on fake-indexeddb.
 *
 * `createWorkoutOrchestrator(deps)` returns:
 * - `startQuick(profileId, sessionName)` → WorkoutDraft
 * - `prepareProgramStart(profileId)` → `PreparedProgramStart | null` (null: no
 *   active program, or its next session is a rest/empty session). `offers.deload`
 *   is present only when recovery is 'fried'; `offers.weakPoint` only when the
 *   injector is on and recovery is 'fresh' (so at most one of them).
 * - `startProgram(prepared, { deload, weakPoint })` → WorkoutDraft; applies the
 *   accepted offers (deload: `applyDeload` with settings; weak point: appends
 *   its 2-set exercise) and marks `isDeload`.
 * - `addExercise(profileId, exercise)` → uid | null (prefilled from history,
 *   warm-ups included; deloaded when the draft is a deload session).
 * - `swapExercise(profileId, uid, exercise)` → uid | null (prefilled, takes the
 *   old exercise's working sets still to do; store rule: done work is never
 *   discarded).
 * - `finish(debrief)` → FinishResult. Does NOT discard the draft; the caller
 *   discards after deciding where to navigate. Throws when there is no draft.
 * - `skipRestDay(profileId)` → advances the active program past a rest session.
 */
import type {
  Exercise,
  Profile,
  ProfileSettings,
  Program,
  WorkoutDebrief,
  WorkoutDraft,
  WorkoutLog,
} from '@/contracts/domain';
import { DEFAULT_PROFILE_SETTINGS } from '@/contracts/domain';
import type { Catalog } from '@/contracts/exercise-catalog';
import type { FinishResult, Repository } from '@/contracts/repo';
import type { RecoverySummary } from '@/contracts/training';
import {
  applyDeload,
  buildProgramSession,
  buildSessionExercise,
  deloadOffer,
  weakPoint,
  type BuiltProgramSession,
  type WeakPointPick,
} from './session-builder';
import { remainingWorkingCount } from './draft-ops';
import { useWorkoutStore } from './workout-store';

export interface WorkoutOrchestratorDeps {
  repo: Repository;
  loadCatalog: () => Promise<Catalog>;
  now?: () => Date;
  store?: typeof useWorkoutStore;
}

export interface ProgramStartOffers {
  deload?: { recovery: RecoverySummary };
  weakPoint?: WeakPointPick;
}

export interface PreparedProgramStart {
  profileId: string;
  settings: ProfileSettings;
  session: BuiltProgramSession;
  offers: ProgramStartOffers;
}

export interface ProgramStartChoice {
  deload: boolean;
  weakPoint: boolean;
}

export function settingsOf(profile: Profile | undefined): ProfileSettings {
  return { ...DEFAULT_PROFILE_SETTINGS, ...profile?.settings };
}

function groupByExercise(logs: readonly WorkoutLog[]): Record<string, WorkoutLog[]> {
  const out: Record<string, WorkoutLog[]> = {};
  for (const log of logs) {
    for (const id of new Set(log.exercises.map((e) => e.exerciseId))) (out[id] ??= []).push(log);
  }
  return out;
}

export function createWorkoutOrchestrator(deps: WorkoutOrchestratorDeps) {
  const { repo } = deps;
  const now = deps.now ?? (() => new Date());
  const store = deps.store ?? useWorkoutStore;

  async function settingsFor(profileId: string): Promise<ProfileSettings> {
    return settingsOf(await repo.profiles.get(profileId));
  }

  async function prepareProgramStart(profileId: string): Promise<PreparedProgramStart | null> {
    const program: Program | undefined = await repo.programs.getActive(profileId);
    if (!program) return null;
    const [settings, logs, catalog, inventory] = await Promise.all([
      settingsFor(profileId),
      repo.logs.list(profileId),
      deps.loadCatalog(),
      repo.equipment.get(profileId),
    ]);
    const lookup = (id: string) => catalog.getById(id);
    const session = buildProgramSession({
      program,
      sessionIndex: program.currentSessionIndex,
      historyByExercise: groupByExercise(logs),
      settings,
      lookup,
    });
    if (!session) return null;
    const at = now();
    const offers: ProgramStartOffers = {};
    const deload = deloadOffer({ history: logs, lookup, now: at });
    if (deload.offer) offers.deload = { recovery: deload.recovery };
    const pick = weakPoint({
      history: logs,
      lookup,
      catalogExercises: catalog.exercises,
      sessionExercises: session.exercises,
      settings,
      inventory,
      now: at,
    });
    if (pick) offers.weakPoint = pick;
    return { profileId, settings, session, offers };
  }

  function startProgram(prepared: PreparedProgramStart, choice: ProgramStartChoice): WorkoutDraft {
    const { session, offers, settings } = prepared;
    const isDeload = choice.deload && offers.deload !== undefined;
    let exercises = isDeload ? applyDeload(session.exercises, settings) : session.exercises;
    if (choice.weakPoint && offers.weakPoint) exercises = [...exercises, offers.weakPoint.sessionExercise];
    return store.getState().startDraft({
      profileId: prepared.profileId,
      sessionName: session.sessionName,
      programId: session.programId,
      programSessionId: session.programSessionId,
      exercises,
      isDeload,
    });
  }

  /**
   * History-prefilled exercise. In a deload draft it gets the deload too
   * (−15 %, −1 set); a given `targetSets` is the final count, so one extra set
   * is built for the deload to drop.
   */
  async function prefilled(profileId: string, exercise: Exercise, targetSets?: number) {
    const [settings, history] = await Promise.all([
      settingsFor(profileId),
      repo.logs.historyFor(profileId, exercise.id),
    ]);
    if (!store.getState().draft?.isDeload) return buildSessionExercise({ exercise, history, settings, targetSets });
    const built = buildSessionExercise({ exercise, history, settings, targetSets: targetSets === undefined ? undefined : targetSets + 1 });
    return applyDeload([built], settings)[0];
  }

  return {
    startQuick: (profileId: string, sessionName: string): WorkoutDraft => store.getState().startQuick(profileId, sessionName),
    prepareProgramStart,
    startProgram,
    async addExercise(profileId: string, exercise: Exercise): Promise<string | null> {
      const se = await prefilled(profileId, exercise);
      return store.getState().addPreparedExercise(se);
    },
    async swapExercise(profileId: string, uid: string, exercise: Exercise): Promise<string | null> {
      const old = store.getState().draft?.exercises.find((e) => e.uid === uid);
      if (!old) return null;
      const count = Math.max(1, remainingWorkingCount(old));
      const se = await prefilled(profileId, exercise, count);
      return store.getState().swapExercise(uid, exercise, se.sets);
    },
    async finish(debrief?: WorkoutDebrief): Promise<FinishResult> {
      const draft = store.getState().draft;
      if (!draft) throw new Error('No workout in progress');
      return repo.finishWorkout(draft, debrief);
    },
    async skipRestDay(profileId: string): Promise<Program | null> {
      const program = await repo.programs.getActive(profileId);
      return program ? repo.programs.advance(profileId, program.id) : null;
    },
  };
}

export type WorkoutOrchestrator = ReturnType<typeof createWorkoutOrchestrator>;
