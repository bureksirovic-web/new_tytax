/**
 * TYTAX v2 — frozen fixture contract (Wave 0, 2026-09-26).
 *
 * 1. Synthetic data builders shared by unit tests and the e2e seed hooks.
 *    Pure and deterministic: the caller passes `now` and an id generator.
 * 2. `E2EHooks`: the `window.__tytaxE2E` object the app installs outside
 *    production builds (or when `NEXT_PUBLIC_E2E_HOOKS=1`). The Playwright
 *    fixture API in `e2e/fixtures/**` is a thin wrapper around it.
 *
 * Every fixture is synthetic. Never put real user data here.
 */

import type {
  Modality,
  Profile,
  ProfileSettings,
  Program,
  ProgramTemplate,
  SetType,
  WorkoutDraft,
  WorkoutLog,
} from './domain';
import { DEFAULT_PROFILE_SETTINGS } from './domain';

export type IdGen = () => string;

/** Deterministic id generator for tests: `prefix-1`, `prefix-2`, … */
export function sequentialIds(prefix = 'id'): IdGen {
  let n = 0;
  return () => `${prefix}-${++n}`;
}

export interface SeedSetInput {
  kg: number;
  reps: number;
  rir?: number;
  /** Default true. */
  done?: boolean;
  /** Default 'working'. */
  type?: SetType;
}

export interface SeedExerciseInput {
  exerciseId: string;
  /** Default: the exercise id. */
  exerciseName?: string;
  /** Default 'tytax'. */
  modality?: Modality;
  sets: SeedSetInput[];
}

export interface SeedLogInput {
  /** Whole days before `now`; the workout starts at `now − daysAgo days`. */
  daysAgo: number;
  /** Default 'Quick Workout'. */
  sessionName?: string;
  programId?: string;
  programSessionId?: string;
  /** Default 3600. */
  durationSeconds?: number;
  rpe?: number;
  notes?: string;
  /** Soft-deleted when true. */
  deleted?: boolean;
  exercises: SeedExerciseInput[];
}

export interface SeedProfileInput {
  /** Default 'Test'. */
  name?: string;
  settings?: Partial<ProfileSettings>;
  /** Make it the device's active profile. Default true. */
  activate?: boolean;
}

export interface SeedProgramInput {
  /** Install a built-in preset by its stable id (e.g. the TYTAX 6-day split). */
  presetId?: string;
  /** Or install this template. */
  template?: ProgramTemplate;
  /** Default true. */
  activate?: boolean;
}

/** Local calendar day of an ISO timestamp or Date, 'YYYY-MM-DD'. */
export function localDay(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const DAY_MS = 86_400_000;

function isWorking(type: SetType): boolean {
  return type !== 'warmup';
}

/** Build a finished, internally consistent synthetic `WorkoutLog`. */
export function buildWorkoutLog(profileId: string, input: SeedLogInput, now: Date, nextId: IdGen): WorkoutLog {
  const started = new Date(now.getTime() - input.daysAgo * DAY_MS);
  const duration = input.durationSeconds ?? 3600;
  const finished = new Date(started.getTime() + duration * 1000);
  const exercises = input.exercises.map((ex) => ({
    uid: nextId(),
    exerciseId: ex.exerciseId,
    exerciseName: ex.exerciseName ?? ex.exerciseId,
    modality: ex.modality ?? ('tytax' as Modality),
    sets: ex.sets.map((s) => {
      const done = s.done ?? true;
      return {
        id: nextId(),
        type: s.type ?? ('working' as SetType),
        kg: s.kg,
        reps: s.reps,
        rir: s.rir,
        done,
        completedAt: done ? finished.toISOString() : undefined,
      };
    }),
  }));
  let totalVolumeKg = 0;
  let totalSets = 0;
  for (const ex of exercises) {
    for (const s of ex.sets) {
      if (s.done && isWorking(s.type)) {
        totalVolumeKg += s.kg * s.reps;
        totalSets += 1;
      }
    }
  }
  const stamp = finished.toISOString();
  return {
    id: nextId(),
    profileId,
    programId: input.programId,
    programSessionId: input.programSessionId,
    sessionName: input.sessionName ?? 'Quick Workout',
    date: localDay(started),
    startedAt: started.toISOString(),
    finishedAt: stamp,
    durationSeconds: duration,
    exercises,
    notes: input.notes,
    rpe: input.rpe,
    totalVolumeKg,
    totalSets,
    prCount: 0,
    modalitiesUsed: [...new Set(exercises.map((e) => e.modality))],
    createdAt: stamp,
    updatedAt: stamp,
    deletedAt: input.deleted ? stamp : undefined,
  };
}

/** Build a synthetic profile with default settings. */
export function buildProfile(input: SeedProfileInput, now: Date, nextId: IdGen): Profile {
  const stamp = now.toISOString();
  return {
    id: nextId(),
    name: input.name ?? 'Test',
    activeProgramId: null,
    settings: { ...DEFAULT_PROFILE_SETTINGS, plateSetKg: [...DEFAULT_PROFILE_SETTINGS.plateSetKg], ...input.settings },
    createdAt: stamp,
    updatedAt: stamp,
  };
}

/** Snapshot of app state the e2e specs may assert on. */
export interface E2EStateSnapshot {
  activeProfileId: string | null;
  draft: WorkoutDraft | null;
}

/** Installed on `window.__tytaxE2E` outside production (or with NEXT_PUBLIC_E2E_HOOKS=1). */
export interface E2EHooks {
  readonly ready: true;
  /** Git SHA the running app was built from. */
  readonly sha: string;
  /** Wipe IndexedDB data and the persisted workout draft. */
  reset(): Promise<void>;
  seedProfile(input?: SeedProfileInput): Promise<Profile>;
  seedHistory(profileId: string, logs: SeedLogInput[]): Promise<WorkoutLog[]>;
  seedProgram(profileId: string, input: SeedProgramInput): Promise<Program>;
  listLogs(profileId: string): Promise<WorkoutLog[]>;
  snapshot(): Promise<E2EStateSnapshot>;
}

declare global {
  interface Window {
    __tytaxE2E?: E2EHooks;
  }
}
