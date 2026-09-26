import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { describe, it, expect } from 'vitest';
import { DEFAULT_PROFILE_SETTINGS, type LegacyUserProfileV2, type LegacyWorkoutLogV2 } from '@/contracts/domain';
import { TytaxDatabase } from '../dexie';
import { createRepository } from '../repository';

/**
 * Smoke test of the Wave 0 baseline v2 → v3 upgrade (G2 owns hardening + the
 * full AC18 suite). Builds a v2 database with the exact v1/v2 store specs.
 */
async function seedV2(name: string, rows: { profiles: unknown[]; programs: unknown[]; workoutLogs: unknown[]; syncQueue: unknown[] }) {
  const legacy = new Dexie(name);
  legacy.version(1).stores({
    profiles: 'id, isAnonymous',
    familyMembers: 'id, profileId',
    equipmentProfiles: 'id, profileId',
    workoutLogs: 'id, profileId, familyMemberId, programId, date, sessionName, deletedAt',
    prRecords: 'id, profileId, exerciseId, prType, achievedAt',
    programs: 'id, profileId, isActive, deletedAt',
    bodyweightEntries: 'id, profileId, date',
    arsenal: 'id, profileId, modality, muscleGroup',
    exerciseNotes: 'id, profileId, exerciseId',
    syncQueue: 'id, tableName, createdAt, retryCount',
    syncMetadata: 'id, profileId, tableName, deviceId',
  });
  legacy.version(2).stores({
    workoutLogs: 'id, profileId, familyMemberId, programId, date, sessionName, deletedAt, updatedAt',
    syncMetadata: 'id, profileId, tableName, deviceId, schemaVersion',
  });
  await legacy.open();
  await legacy.table('profiles').bulkAdd(rows.profiles);
  await legacy.table('programs').bulkAdd(rows.programs);
  await legacy.table('workoutLogs').bulkAdd(rows.workoutLogs);
  await legacy.table('syncQueue').bulkAdd(rows.syncQueue);
  legacy.close();
}

const legacyProfile: LegacyUserProfileV2 = {
  id: 'p1',
  displayName: 'Tomi',
  language: 'en',
  unitSystem: 'imperial',
  theme: 'oled',
  warmupStrategy: 'heavy',
  autoBackup: false,
  barWeightKg: 15,
  isAnonymous: true,
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-02T00:00:00.000Z',
};

const legacyLog: LegacyWorkoutLogV2 = {
  id: 'log1',
  profileId: 'p1',
  familyMemberId: 'fm1',
  sessionName: 'Push',
  date: '2025-01-03',
  startedAt: '2025-01-03T10:00:00.000Z',
  durationSeconds: 3600,
  exercises: [
    {
      exerciseRef: 'bench',
      exerciseName: 'Bench',
      modality: 'tytax',
      sets: [
        { id: 's1', setNumber: 1, type: 'working', kg: 60, reps: 5, done: true, isPersonalRecord: true, timestamp: '2025-01-03T10:05:00.000Z' },
        { id: 's2', setNumber: 2, type: 'working', kg: 60, reps: 5, done: false, timestamp: '2025-01-03T10:08:00.000Z' },
      ],
    },
  ],
  totalVolumeKg: 300,
  totalSets: 1,
  prCount: 1,
  modalitiesUsed: ['tytax'],
  createdAt: '2025-01-03T11:00:00.000Z',
};

describe('Dexie v2 → v3 upgrade (baseline)', () => {
  it('migrates profiles, the active program and workout logs; clears the old outbox', async () => {
    const name = `mig-${Math.random().toString(36).slice(2)}`;
    await seedV2(name, {
      profiles: [legacyProfile],
      programs: [
        { id: 'prog1', profileId: 'p1', name: 'PPL', isActive: true, sessions: [], sessionOrder: [], modalitiesUsed: ['tytax'], currentSessionIndex: 0 },
        { id: 'prog2', profileId: 'p1', name: 'Old', isActive: false, sessions: [], sessionOrder: [], modalitiesUsed: ['tytax'], currentSessionIndex: 0 },
      ],
      workoutLogs: [legacyLog],
      syncQueue: [{ id: 'q1', tableName: 'workout_logs', operationType: 'create', recordId: 'log1', payload: {}, createdAt: '2025-01-03T11:00:00.000Z', retryCount: 0 }],
    });

    const db = new TytaxDatabase(name);
    await db.open();
    expect(db.verno).toBe(3);
    expect(db.tables.map((t) => t.name).sort()).not.toContain('familyMembers');

    const profile = await db.profiles.get('p1');
    expect(profile).toMatchObject({ id: 'p1', name: 'Tomi', activeProgramId: 'prog1' });
    expect(profile?.settings).toEqual({ ...DEFAULT_PROFILE_SETTINGS, units: 'lb', language: 'en', theme: 'oled', warmupStrategy: 'heavy', barWeightKg: 15 });

    const programs = await db.programs.toArray();
    expect(programs.every((p) => !('isActive' in p))).toBe(true);

    const log = await db.workoutLogs.get('log1');
    const ex = log?.exercises[0];
    expect(ex?.exerciseId).toBe('bench');
    expect(typeof ex?.uid).toBe('string');
    expect(ex?.sets[0]).toEqual({ id: 's1', type: 'working', kg: 60, reps: 5, done: true, completedAt: '2025-01-03T10:05:00.000Z', isPR: true });
    expect(ex?.sets[1]).toEqual({ id: 's2', type: 'working', kg: 60, reps: 5, done: false });
    expect(log?.finishedAt).toBe(legacyLog.startedAt);
    expect(log && 'familyMemberId' in log).toBe(false);
    expect(await db.syncQueue.count()).toBe(0);

    const repo = createRepository({ db });
    expect((await repo.programs.getActive('p1'))?.id).toBe('prog1');
    expect((await repo.logs.list('p1')).map((l) => l.id)).toEqual(['log1']);
    db.close();
  });
});
