/**
 * Test helpers for the Dexie repository. Import 'fake-indexeddb/auto' in the
 * test file itself before this module.
 */
import { vi, type Mock } from 'vitest';
import type { ProgramTemplate, SessionExercise, SetType, WorkoutDraft } from '@/contracts/domain';
import type { Repository } from '@/contracts/repo';
import type { SyncAdapter, SyncState } from '@/contracts/sync';
import { sequentialIds } from '@/contracts/fixtures';
import { TytaxDatabase } from '../dexie';
import { createRepository } from '../repository';

let dbCounter = 0;

export interface TestRepo {
  db: TytaxDatabase;
  repo: Repository;
  /** Moves the injected clock forward. */
  tick(ms?: number): void;
  now(): Date;
}

/** Fixed start: 2026-03-02 12:00 local time (local noon keeps `date` stable in any TZ). */
export const T0 = new Date(2026, 2, 2, 12, 0, 0, 0);

export function freshRepo(opts: { sync?: SyncAdapter; start?: Date } = {}): TestRepo {
  dbCounter += 1;
  const db = new TytaxDatabase(`t-${dbCounter}-${Math.random().toString(36).slice(2)}`);
  let clock = (opts.start ?? T0).getTime();
  const now = () => new Date(clock);
  const repo = createRepository({ db, now, newId: sequentialIds('id'), sync: opts.sync });
  return {
    db,
    repo,
    now,
    tick(ms = 1000) {
      clock += ms;
    },
  };
}

export interface FakeSync extends SyncAdapter {
  notifyChanged: Mock<() => void>;
}

export function fakeSync(enabled = true): FakeSync {
  const state: SyncState = { status: 'idle', lastSyncedAt: null, pending: 0 };
  return {
    enabled,
    notifyChanged: vi.fn<() => void>(),
    syncNow: async () => ({ pushed: 0, pulled: 0, failed: 0, state }),
    getState: () => state,
    subscribe: () => () => {},
  };
}

export interface SetSpec {
  kg: number;
  reps: number;
  done?: boolean;
  type?: SetType;
}

let setCounter = 0;

export function exercise(uid: string, exerciseId: string, sets: SetSpec[]): SessionExercise {
  return {
    uid,
    exerciseId,
    exerciseName: exerciseId,
    modality: 'tytax',
    sets: sets.map((s) => {
      setCounter += 1;
      return { id: `${uid}-set-${setCounter}`, type: s.type ?? 'working', kg: s.kg, reps: s.reps, done: s.done ?? true };
    }),
  };
}

export function draft(id: string, profileId: string, exercises: SessionExercise[], extra: Partial<WorkoutDraft> = {}): WorkoutDraft {
  return { id, profileId, sessionName: 'Test session', startedAt: T0.toISOString(), exercises, ...extra };
}

export function template(sessionCount: number, extra: Partial<ProgramTemplate> = {}): ProgramTemplate {
  return {
    name: `${sessionCount}-day split`,
    splitType: 'custom',
    frequency: sessionCount,
    periodizationType: 'none',
    sessionOrder: Array.from({ length: sessionCount }, (_, i) => `Day ${i + 1}`),
    sessions: Array.from({ length: sessionCount }, (_, i) => ({
      id: `tpl-session-${i}`,
      programId: 'tpl',
      name: `Day ${i + 1}`,
      dayIndex: i,
      exercises: [{ exerciseId: 'bench', exerciseName: 'Bench', modality: 'tytax' as const, sets: 3, reps: '8-12' }],
    })),
    modalitiesUsed: ['tytax'],
    isPreset: true,
    presetId: 'preset-test',
    currentSessionIndex: 0,
    ...extra,
  };
}
