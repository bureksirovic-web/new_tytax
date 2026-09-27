/** Synthetic Dexie v2 rows (no real user data). Builders return fresh objects. */
import type { LegacyProgramV2, LegacyUserProfileV2, LegacyWorkoutLogV2 } from '@/contracts';
import type { SnapshotV2 } from '../types';

type LegacySet = LegacyWorkoutLogV2['exercises'][number]['sets'][number];

export function set(n: number, over: Partial<LegacySet>): LegacySet {
  return { id: `s-${n}`, setNumber: n, type: 'working', kg: 0, reps: 0, done: true, timestamp: `2026-03-01T09:0${n}:00.000Z`, ...over };
}

/**
 * Bench appears twice (same exerciseRef). Legacy totals counted the warm-up
 * (20×10 = 200) and so stored 2235 / 6; the contract total is below.
 */
export function v2Log(): LegacyWorkoutLogV2 {
  return {
    id: 'log-1',
    profileId: 'local',
    programId: 'p-2',
    sessionName: 'Push A',
    date: '2026-03-01',
    startedAt: '2026-03-01T09:00:00.000Z',
    finishedAt: '2026-03-01T10:00:00.000Z',
    durationSeconds: 3600,
    exercises: [
      {
        exerciseRef: 'bench',
        exerciseName: 'Bench Press',
        modality: 'TYTAX',
        sets: [
          set(1, { type: 'warmup', kg: 20, reps: 10 }),
          set(2, { kg: 60, reps: 8, rir: 2, tempo: '3-1-1-0' }),
          set(3, { kg: 62.5, reps: 6, rir: 7, isPersonalRecord: true, e1rm: 74.5 }),
          set(4, { kg: 65, reps: 5, done: false }),
        ],
        restSeconds: 120,
      },
      { exerciseRef: 'kb-swing', exerciseName: 'KB Swing', modality: 'kettlebell', sets: [set(5, { kg: 24, reps: 15 })] },
      {
        exerciseRef: 'bench',
        exerciseName: 'Bench Press',
        modality: 'machine',
        supersetGroup: 'A',
        sets: [set(6, { kg: 50, reps: 10, rir: -1 }), set(7, { type: 'drop', kg: 40, reps: 8 })],
      },
    ],
    totalVolumeKg: 2235,
    totalSets: 6,
    prCount: 1,
    modalitiesUsed: ['tytax', 'kettlebell', 'machine'],
    createdAt: '2026-03-01T10:00:00.000Z',
    updatedAt: '2026-03-01T10:00:00.000Z',
  };
}

/** A family member's log with no `finishedAt` and no `updatedAt` (pre-v2-upgrade row). */
export function v2FamilyLog(): LegacyWorkoutLogV2 {
  return {
    id: 'log-2',
    profileId: 'local',
    familyMemberId: 'fm-1',
    sessionName: 'Quick Workout',
    date: '2026-03-02',
    startedAt: '2026-03-02T10:00:00.000Z',
    durationSeconds: 1800,
    exercises: [{ exerciseRef: 'pullup', exerciseName: 'Pull-up', modality: 'bodyweight', sets: [set(1, { kg: 0, reps: 8 })] }],
    totalVolumeKg: 0,
    totalSets: 1,
    prCount: 0,
    modalitiesUsed: ['bodyweight'],
    createdAt: '2026-03-02T10:30:00.000Z',
  };
}

export function v2User(over: Partial<LegacyUserProfileV2> = {}): LegacyUserProfileV2 {
  return {
    id: 'u-1',
    displayName: 'Test Lifter',
    language: 'en',
    unitSystem: 'imperial',
    theme: 'oled',
    bodyweightKg: 80,
    warmupStrategy: 'heavy',
    autoBackup: false,
    barWeightKg: 15,
    isAnonymous: true,
    activeFamilyMemberId: 'fm-1',
    activeEquipmentProfileId: 'eq-2',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-02-01T00:00:00.000Z',
    ...over,
  };
}

export function v2Program(id: string, over: Partial<LegacyProgramV2> = {}): LegacyProgramV2 {
  return {
    id,
    profileId: 'local',
    name: `Program ${id}`,
    splitType: 'upper_lower',
    frequency: 2,
    periodizationType: 'none',
    sessionOrder: ['Upper', 'Lower'],
    sessions: [
      { id: `${id}-s1`, programId: id, name: 'Upper', dayIndex: 0, exercises: [{ exerciseId: 'bench', exerciseName: 'Bench Press', modality: 'TYTAX', sets: 3, reps: '8-12' }] },
      { id: `${id}-s2`, programId: id, name: 'Lower', dayIndex: 1, exercises: [{ exerciseId: 'goblet', exerciseName: 'Goblet Squat', modality: 'kb', sets: 3, reps: '10' }] },
    ],
    modalitiesUsed: ['tytax', 'kb'],
    isActive: false,
    isPreset: false,
    currentSessionIndex: 0,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    ...over,
  };
}

export function v2Snapshot(): SnapshotV2 {
  return {
    profiles: [v2User()],
    familyMembers: [{ id: 'fm-1', profileId: 'u-1', name: 'Kid', gender: 'female', createdAt: '2026-01-05T00:00:00.000Z' }],
    equipmentProfiles: [
      { id: 'eq-1', profileId: 'local', name: 'Old', hasSmithMachine: false, hasUpperPulley: false, hasLowerPulley: false, hasLegExtension: false, hasLegCurl: false, attachments: [], hasPullUpBar: false, hasDipStation: false, hasRings: false, hasParallettes: false, kettlebellWeights: [], plateWeights: [], barWeightKg: 20 },
      { id: 'eq-2', profileId: 'u-1', name: 'Home', hasSmithMachine: true, hasUpperPulley: true, hasLowerPulley: false, hasLegExtension: false, hasLegCurl: true, attachments: ['rope'], hasPullUpBar: true, hasDipStation: false, hasRings: true, hasParallettes: false, kettlebellWeights: [16, 24], plateWeights: [5, 20, 10, 20], barWeightKg: 15 },
    ],
    workoutLogs: [v2Log(), v2FamilyLog()],
    programs: [
      v2Program('p-1', { isActive: true, updatedAt: '2026-03-01' }),
      v2Program('p-2', { isActive: true, updatedAt: '2026-03-05', currentSessionIndex: 9 }),
      v2Program('p-3', { isActive: true, updatedAt: '2026-03-09', deletedAt: '2026-03-09' }),
      v2Program('p-4', { profileId: 'fm-1' }),
    ],
    prRecords: [{ id: 'pr-1', profileId: 'local', exerciseId: 'pullup', exerciseName: 'Pull-up', prType: 'volume', value: 400, reps: 8, achievedAt: '2026-03-02T10:30:00.000Z', workoutLogId: 'log-2' }],
    bodyweightEntries: [{ id: 'bw-1', profileId: 'local', date: '2026-03-01', valueKg: 80.5, createdAt: '2026-03-01T07:00:00.000Z' }],
    exerciseNotes: [{ id: 'n-1', profileId: 'local', exerciseId: 'bench', content: 'Elbows in', updatedAt: '2026-03-01T08:00:00.000Z' }],
    arsenal: [{ id: 'bench', profileId: 'local', addedAt: '2026-02-01T00:00:00.000Z', name: 'Bench Press' }],
    syncQueue: [{ id: 'op-1', tableName: 'workout_logs', operationType: 'create', recordId: 'log-1', payload: {}, createdAt: '2026-03-01', retryCount: 0 }],
    syncMetadata: [{ id: 'schema_version', profileId: '', tableName: '', deviceId: '', lastSyncedAt: '2026-01-01', schemaVersion: 2 }],
  };
}

export const CTX = { now: '2026-09-26T00:00:00.000Z', newId: () => 'synth-1' };
