import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { DEFAULT_PROFILE_SETTINGS, type LegacyUserProfileV2, type LegacyWorkoutLogV2 } from '@/contracts/domain';
import { TytaxDatabase } from '../dexie';
import { createRepository } from '../repository';
import { dbName, seedLegacy } from '../migrations/__tests__/v2-db';

/**
 * The Wave 0 baseline scenario against the hardened v2 -> v3 upgrade: a v2
 * database built with the exact v1/v2 store specs (migrations/__tests__/v2-db).
 * The full AC18 suite is migration-dexie.test.ts / migration-edge.test.ts.
 */
const legacyProfile: LegacyUserProfileV2 = {
  id: 'p1',
  displayName: 'Test Lifter',
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

describe('Dexie v2 → v3 upgrade (baseline scenario)', () => {
  it('migrates profiles, the active program and workout logs; clears the old outbox', async () => {
    const name = dbName('mig-baseline');
    await seedLegacy(name, {
      profiles: [legacyProfile],
      programs: [
        { id: 'prog1', profileId: 'p1', name: 'PPL', isActive: true, sessions: [], sessionOrder: [], modalitiesUsed: ['tytax'], currentSessionIndex: 0 },
        { id: 'prog2', profileId: 'p1', name: 'Old', isActive: false, sessions: [], sessionOrder: [], modalitiesUsed: ['tytax'], currentSessionIndex: 0 },
      ],
      workoutLogs: [legacyLog],
      syncQueue: [{ id: 'q1', tableName: 'workout_logs', operationType: 'create', recordId: 'log1', payload: {}, createdAt: '2025-01-03T11:00:00.000Z', retryCount: 0 }],
    });

    const db = new TytaxDatabase(name, { now: () => new Date('2026-09-26T00:00:00.000Z') });
    await db.open();
    expect(db.verno).toBe(3);
    expect(db.tables.map((t) => t.name).sort()).not.toContain('familyMembers');

    const profile = await db.profiles.get('p1');
    expect(profile).toMatchObject({ id: 'p1', name: 'Test Lifter', activeProgramId: 'prog1' });
    expect(profile?.settings).toEqual({ ...DEFAULT_PROFILE_SETTINGS, units: 'lb', language: 'en', theme: 'oled', warmupStrategy: 'heavy', barWeightKg: 15 });

    const programs = await db.programs.toArray();
    expect(programs.every((p) => !('isActive' in p))).toBe(true);

    const log = await db.workoutLogs.get('log1');
    const ex = log?.exercises[0];
    expect(ex?.exerciseId).toBe('bench');
    // Deterministic uid (`<logId>:<index>`), so a re-run yields the same rows.
    expect(ex?.uid).toBe('log1:0');
    expect(ex?.sets[0]).toEqual({ id: 's1', type: 'working', kg: 60, reps: 5, done: true, completedAt: '2025-01-03T10:05:00.000Z', isPR: true });
    expect(ex?.sets[1]).toEqual({ id: 's2', type: 'working', kg: 60, reps: 5, done: false });
    // No v2 finishedAt: startedAt + durationSeconds (10:00 + 3600 s).
    expect(log?.finishedAt).toBe('2025-01-03T11:00:00.000Z');
    // Totals recomputed from done working sets: only s1 (60×5 = 300, 1 set, 1 PR).
    expect(log).toMatchObject({ totalVolumeKg: 300, totalSets: 1, prCount: 1 });
    expect(log && 'familyMemberId' in log).toBe(false);
    expect(await db.syncQueue.count()).toBe(0);
    expect((await db.meta.get('preMigrationExport.v2'))?.value).toMatchObject({ tables: { syncQueue: [{ id: 'q1' }] } });

    const repo = createRepository({ db });
    expect((await repo.programs.getActive('p1'))?.id).toBe('prog1');
    expect((await repo.logs.list('p1')).map((l) => l.id)).toEqual(['log1']);
    db.close();
  });
});
