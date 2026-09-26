/** Shared test data for the dashboard page tests: a fresh fake-IndexedDB repository per test. */
import 'fake-indexeddb/auto';
import type { Mock } from 'vitest';
import type { ProgramSession, ProgramTemplate, WorkoutLog } from '@/contracts/domain';
import type { BackupV3, Repository } from '@/contracts/repo';
import { buildWorkoutLog, sequentialIds, type SeedLogInput } from '@/contracts/fixtures';
import { createRepository, TytaxDatabase } from '@/lib/db';

/** Wednesday 2026-09-23 12:00 local: this ISO week starts Mon 09-21, last week Mon 09-14. */
export const NOW = new Date(2026, 8, 23, 12, 0, 0);

export const BENCH = 'tytax_smith-machine_smith-flat-bench-press'; // Chest 95, Triceps 65, Front Delts 35
export const SQUAT = 'tytax_smith-machine_smith-back-squat';

export interface Holder {
  repo: unknown;
  push: Mock;
}

let n = 0;
export function installRepo(holder: Holder): Repository {
  n += 1;
  const repo = createRepository({ db: new TytaxDatabase(`dashboard-page-${n}`) });
  holder.repo = repo;
  holder.push.mockClear();
  return repo;
}

const ids = sequentialIds('seed');

/** Writes finished logs through the repository's backup import (as the e2e seed hook does). */
export async function seedLogs(repo: Repository, profileId: string, logs: SeedLogInput[]): Promise<WorkoutLog[]> {
  const built = logs.map((l) => buildWorkoutLog(profileId, l, NOW, ids));
  const backup: BackupV3 = {
    format: 'tytax-backup',
    version: 3,
    exportedAt: NOW.toISOString(),
    profiles: [],
    workoutLogs: built,
    programs: [],
    prRecords: [],
    bodyweightEntries: [],
    exerciseNotes: [],
    arsenal: [],
    equipment: [],
  };
  await repo.importBackup(backup);
  return built;
}

function session(i: number, name: string, exerciseIds: string[], isRest = false): ProgramSession {
  return {
    id: `sess-${i}`,
    programId: 'tmp',
    name,
    dayIndex: i,
    isRest,
    exercises: exerciseIds.map((exerciseId) => ({ exerciseId, exerciseName: exerciseId, modality: 'tytax', sets: 3, reps: '8-12' })),
  };
}

/** Rotation: Push A (2 exercises) → Rest → Legs B (1 exercise). */
export const TEMPLATE: ProgramTemplate = {
  name: 'Dash Split',
  splitType: 'custom',
  frequency: 2,
  periodizationType: 'linear',
  sessionOrder: ['Push A', 'Rest', 'Legs B'],
  sessions: [session(0, 'Push A', [BENCH, SQUAT]), session(1, 'Rest', [], true), session(2, 'Legs B', [SQUAT])],
  modalitiesUsed: ['tytax'],
  isPreset: false,
  currentSessionIndex: 0,
};
