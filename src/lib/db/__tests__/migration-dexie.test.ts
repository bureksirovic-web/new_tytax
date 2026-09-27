import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { DEFAULT_PROFILE_SETTINGS, type Profile, type SetEntry, type WorkoutLog } from '@/contracts/domain';
import { TytaxDatabase } from '../dexie';
import { ACTIVE_PROFILE_KEY } from '../repo/profiles';
import { ACTIVE_PROFILE_META_KEY, createV3Upgrade, getPreMigrationExport } from '../migrations';
import { migrateSnapshotV2toV3 } from '../migrations/index';
import type { SnapshotV2 } from '../migrations/index';
import { CTX, v2Snapshot } from '../migrations/__tests__/fixture';
import { dbName, dump, seedLegacy, sortById } from '../migrations/__tests__/v2-db';

const NOW = new Date(CTX.now);
const deps = { now: () => NOW, newId: CTX.newId };

async function migrated(): Promise<TytaxDatabase> {
  const name = dbName('mig-dexie');
  await seedLegacy(name, { ...v2Snapshot() });
  const db = new TytaxDatabase(name, deps);
  await db.open();
  return db;
}

const set = (n: number, extra: Pick<SetEntry, 'type' | 'kg' | 'reps'> & Partial<SetEntry>): SetEntry => ({ id: `s-${n}`, done: true, completedAt: `2026-03-01T09:0${n}:00.000Z`, ...extra });

/**
 * Hand-derived from fixture v2Log(): done, non-warm-up sets only.
 *   bench     60×8 = 480, 62.5×6 = 375 (65×5 not done, 20×10 warm-up excluded)
 *   kb-swing  24×15 = 360
 *   bench #2  50×10 = 500, 40×8 = 320
 *   volume 480 + 375 + 360 + 500 + 320 = 2035; sets 5; PRs 1 (s-3).
 * v2 had stored 2235 / 6 (warm-up counted).
 */
const expectedLog: WorkoutLog = {
  id: 'log-1',
  profileId: 'u-1',
  programId: 'p-2',
  sessionName: 'Push A',
  date: '2026-03-01',
  startedAt: '2026-03-01T09:00:00.000Z',
  finishedAt: '2026-03-01T10:00:00.000Z',
  durationSeconds: 3600,
  exercises: [
    {
      uid: 'log-1:0',
      exerciseId: 'bench',
      exerciseName: 'Bench Press',
      modality: 'tytax',
      restSeconds: 120,
      sets: [
        set(1, { type: 'warmup', kg: 20, reps: 10 }),
        set(2, { type: 'working', kg: 60, reps: 8, rir: 2, tempo: '3-1-1-0' }),
        set(3, { type: 'working', kg: 62.5, reps: 6, rir: 5, isPR: true, e1rm: 74.5 }),
        { id: 's-4', type: 'working', kg: 65, reps: 5, done: false },
      ],
    },
    { uid: 'log-1:1', exerciseId: 'kb-swing', exerciseName: 'KB Swing', modality: 'kettlebell', sets: [set(5, { type: 'working', kg: 24, reps: 15 })] },
    {
      uid: 'log-1:2',
      exerciseId: 'bench',
      exerciseName: 'Bench Press',
      modality: 'custom',
      supersetGroup: 'A',
      sets: [set(6, { type: 'working', kg: 50, reps: 10, rir: 0 }), set(7, { type: 'drop', kg: 40, reps: 8 })],
    },
  ],
  totalVolumeKg: 2035,
  totalSets: 5,
  prCount: 1,
  modalitiesUsed: ['tytax', 'kettlebell', 'custom'],
  createdAt: '2026-03-01T10:00:00.000Z',
  updatedAt: '2026-03-01T10:00:00.000Z',
};

const userSettings = { ...DEFAULT_PROFILE_SETTINGS, units: 'lb', language: 'en', theme: 'oled', warmupStrategy: 'heavy', barWeightKg: 15, plateSetKg: [20, 10, 5] } as Profile['settings'];

describe('Dexie v2 -> v3 upgrade on a real (fake-indexeddb) database', () => {
  it('rewrites logs as SessionExercise[] with distinct uids and warm-up-free totals', async () => {
    const db = await migrated();
    expect(db.verno).toBe(3);
    expect(await db.workoutLogs.get('log-1')).toStrictEqual(expectedLog);
    const uids = expectedLog.exercises.map((e) => e.uid);
    expect(new Set(uids).size).toBe(3);
    expect((await db.workoutLogs.get('log-2'))?.profileId).toBe('fm-1');
    db.close();
  });

  it('moves isActive to Profile.activeProgramId and maps family members to profiles', async () => {
    const db = await migrated();
    expect(await db.profiles.toArray()).toStrictEqual([
      { id: 'fm-1', name: 'Kid', activeProgramId: null, settings: userSettings, gender: 'female', createdAt: '2026-01-05T00:00:00.000Z', updatedAt: '2026-01-05T00:00:00.000Z' },
      { id: 'u-1', name: 'Test Lifter', activeProgramId: 'p-2', settings: userSettings, bodyweightKg: 80, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-02-01T00:00:00.000Z' },
    ]);
    const programs = await db.programs.toArray();
    expect(programs.map((p) => [p.id, p.profileId])).toEqual([['p-1', 'u-1'], ['p-2', 'u-1'], ['p-3', 'u-1'], ['p-4', 'fm-1']]);
    expect(programs.some((p) => 'isActive' in p)).toBe(false);
    expect(ACTIVE_PROFILE_META_KEY).toBe(ACTIVE_PROFILE_KEY);
    expect(await db.meta.get(ACTIVE_PROFILE_KEY)).toEqual({ key: ACTIVE_PROFILE_KEY, value: 'fm-1' });
    expect(await db.syncQueue.count()).toBe(0);
    db.close();
  });

  it('writes exactly what the pure transform returns, for every v3 table', async () => {
    const db = await migrated();
    const { tables } = migrateSnapshotV2toV3(v2Snapshot(), CTX);
    for (const [name, rows] of Object.entries(tables)) {
      expect(await db.table(name).toArray(), name).toStrictEqual(sortById(rows as Array<{ id: string }>));
    }
    db.close();
  });

  it('stores the pre-migration export, which JSON round-trips to the v2 rows', async () => {
    const db = await migrated();
    const backup = await getPreMigrationExport(db);
    expect(backup).not.toBeNull();
    expect(backup?.format).toBe('tytax-v2-premigration');
    expect(backup?.exportedAt).toBe(CTX.now);
    expect(JSON.parse(JSON.stringify(backup))).toStrictEqual(backup);
    const seeded = v2Snapshot();
    expect(sortById(backup?.tables.workoutLogs as Array<{ id: string }>)).toStrictEqual(sortById(seeded.workoutLogs ?? []));
    expect(backup?.tables.familyMembers).toStrictEqual(seeded.familyMembers);
    expect(backup?.tables.syncQueue).toStrictEqual(seeded.syncQueue);
    expect(Object.keys(backup?.tables ?? {}).sort()).toEqual(
      ['arsenal', 'bodyweightEntries', 'equipmentProfiles', 'exerciseNotes', 'familyMembers', 'prRecords', 'profiles', 'programs', 'syncMetadata', 'syncQueue', 'workoutLogs'],
    );
    db.close();
  });

  it('reopening, and re-running the upgrade over v3 rows, change nothing', async () => {
    const db = await migrated();
    const before = await dump(db);
    db.close();

    const later = { now: () => new Date('2027-01-01T00:00:00.000Z'), newId: () => 'other' };
    const reopened = new TytaxDatabase(db.name, later);
    await reopened.open();
    expect(await dump(reopened)).toStrictEqual(before);

    await reopened.transaction('rw', reopened.tables, (tx) => createV3Upgrade(later)(tx));
    const after = await dump(reopened);
    expect(after).toStrictEqual(before);
    expect(Object.values(after).map((rows) => rows.length)).toEqual(Object.values(before).map((rows) => rows.length));
    reopened.close();
  });

  it('the pure transform over the migrated v3 rows is the identity', async () => {
    const db = await migrated();
    const v3 = await dump(db);
    db.close();
    const { tables } = migrateSnapshotV2toV3(v3 as SnapshotV2, { ...CTX, now: '2030-01-01T00:00:00.000Z' });
    for (const [name, rows] of Object.entries(tables)) expect(rows, name).toStrictEqual(v3[name]);
  });
});
