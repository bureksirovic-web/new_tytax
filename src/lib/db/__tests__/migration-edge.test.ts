import 'fake-indexeddb/auto';
import { describe, expect, it, vi } from 'vitest';
import type { LegacyWorkoutLogV2 } from '@/contracts/domain';
import { DEFAULT_PROFILE_SETTINGS } from '@/contracts';
import { DEFAULT_DB_NAME, TytaxDatabase, getDb } from '../dexie';
import { PRE_MIGRATION_EXPORT_KEY, clearPreMigrationExport, getPreMigrationExport } from '../migrations';
import { CTX, v2Log, v2Program, v2Snapshot, v2User } from '../migrations/__tests__/fixture';
import { dbName, dump, legacyDb, seedLegacy } from '../migrations/__tests__/v2-db';

const deps = { now: () => new Date(CTX.now), newId: CTX.newId };

/**
 * The transforms no longer throw on malformed v2 shapes (refuter R1, 2026-09-27),
 * so the rollback test injects the failure: the log transform throws for one id.
 */
const THROWING_LOG_ID = 'log-throws';
vi.mock('../migrations/log', async (importOriginal) => {
  const orig = await importOriginal<typeof import('../migrations/log')>();
  return {
    ...orig,
    migrateLogV2: (log: Parameters<typeof orig.migrateLogV2>[0], ctx: Parameters<typeof orig.migrateLogV2>[1]) => {
      if (log.id === THROWING_LOG_ID) throw new Error('injected transform failure');
      return orig.migrateLogV2(log, ctx);
    },
  };
});

describe('Dexie v2 -> v3 upgrade: failure and edge cases', () => {
  it('a throwing transform aborts the upgrade and leaves the v2 database intact', async () => {
    const name = dbName('mig-fail');
    // The mocked log transform throws for this id (see vi.mock above).
    const bad: LegacyWorkoutLogV2 = { ...v2Log(), id: THROWING_LOG_ID };
    const seeded = { ...v2Snapshot(), workoutLogs: [v2Log(), bad] };
    await seedLegacy(name, seeded);
    const legacyBefore = legacyDb(name);
    await legacyBefore.open();
    const before = await dump(legacyBefore);
    legacyBefore.close();

    const db = new TytaxDatabase(name, deps);
    await expect(db.open()).rejects.toThrow(/injected transform failure/);
    db.close();

    const legacy = legacyDb(name);
    await legacy.open();
    expect(legacy.verno).toBe(2);
    expect(legacy.backendDB().objectStoreNames.contains('meta')).toBe(false);
    expect(await dump(legacy)).toStrictEqual(before);
    expect(await legacy.table('workoutLogs').get('log-1')).toMatchObject({ totalVolumeKg: 2235, totalSets: 6 });
    expect(await legacy.table('programs').filter((p: { isActive?: boolean }) => p.isActive === true).count()).toBe(3);
    legacy.close();
  });

  it('upgrades a v1 database through the v2 backfill to v3', async () => {
    const name = dbName('mig-v1');
    const log = { ...v2Log(), updatedAt: undefined, finishedAt: undefined };
    await seedLegacy(name, { workoutLogs: [log] }, 1);
    const db = new TytaxDatabase(name, deps);
    await db.open();
    const migrated = await db.workoutLogs.get('log-1');
    // v2 backfill: updatedAt = createdAt. v3: finishedAt = startedAt + 3600 s.
    expect(migrated?.updatedAt).toBe('2026-03-01T10:00:00.000Z');
    expect(migrated?.finishedAt).toBe('2026-03-01T10:00:00.000Z');
    expect(migrated?.totalVolumeKg).toBe(2035);
    const backup = await getPreMigrationExport(db);
    expect(backup?.tables.syncMetadata).toHaveLength(1);
    db.close();
  });

  it("synthesises a primary profile for 'local' rows when v2 has none", async () => {
    const name = dbName('mig-synth');
    await seedLegacy(name, { workoutLogs: [v2Log()] });
    const db = new TytaxDatabase(name, deps);
    await db.open();
    expect(await db.profiles.toArray()).toMatchObject([{ id: 'synth-1', name: 'Profile', activeProgramId: null, createdAt: CTX.now }]);
    expect((await db.workoutLogs.get('log-1'))?.profileId).toBe('synth-1');
    expect((await db.meta.get('activeProfileId'))?.value).toBe('synth-1');
    db.close();
  });

  it('an empty v2 database upgrades to empty v3 tables with an empty export and no active profile', async () => {
    const name = dbName('mig-empty');
    await seedLegacy(name, {});
    const db = new TytaxDatabase(name, deps);
    await db.open();
    expect(await db.profiles.count()).toBe(0);
    expect(await db.meta.get('activeProfileId')).toBeUndefined();
    const backup = await getPreMigrationExport(db);
    expect(Object.values(backup?.tables ?? { x: [1] }).every((rows) => rows.length === 0)).toBe(true);
    db.close();
  });

  it('getPreMigrationExport: null on a fresh install, on a foreign value, and after clear', async () => {
    const db = new TytaxDatabase(dbName('mig-fresh'), deps);
    await db.open();
    expect(await getPreMigrationExport(db)).toBeNull();
    await db.meta.put({ key: PRE_MIGRATION_EXPORT_KEY, value: { format: 'other', version: 2, exportedAt: CTX.now, tables: {} } });
    expect(await getPreMigrationExport(db)).toBeNull();
    await db.meta.put({ key: PRE_MIGRATION_EXPORT_KEY, value: 'not-an-object' });
    expect(await getPreMigrationExport(db)).toBeNull();
    const valid = { format: 'tytax-v2-premigration', version: 2, exportedAt: CTX.now, tables: { profiles: [] } };
    await db.meta.put({ key: PRE_MIGRATION_EXPORT_KEY, value: valid });
    expect(await getPreMigrationExport(db)).toStrictEqual(valid);
    await clearPreMigrationExport(db);
    expect(await getPreMigrationExport(db)).toBeNull();
    expect(await db.meta.count()).toBe(0);
    db.close();
  });

  it('defaults: real clock for the upgrade stamp; getDb is a lazy singleton on the default name', async () => {
    const name = dbName('mig-default-clock');
    await seedLegacy(name, {});
    const db = new TytaxDatabase(name);
    await db.open();
    const stamp = (await getPreMigrationExport(db))?.exportedAt ?? '';
    expect(new Date(stamp).toISOString()).toBe(stamp);
    db.close();

    const app = getDb();
    expect(getDb()).toBe(app);
    expect(app.name).toBe(DEFAULT_DB_NAME);
    expect(app.isOpen()).toBe(false);
  });
});

/**
 * Refuter R1 (2026-09-27): each of these v2 shapes made a transform throw, so
 * the upgrade aborted on every open and the app could never open its database.
 * The transforms now coerce them: the upgrade completes and the healthy rows migrate.
 */
describe('Dexie v2 -> v3 upgrade: malformed legacy shapes complete the upgrade', () => {
  const broken = (over: Record<string, unknown>) => ({ ...v2Log(), id: 'log-broken', ...over }) as unknown as LegacyWorkoutLogV2;
  const exercise = (sets: unknown) => ({ exerciseRef: 'bench', exerciseName: 'Bench', modality: 'tytax', sets });

  async function upgraded(rows: Record<string, unknown[]>) {
    const name = dbName('mig-malformed');
    await seedLegacy(name, rows);
    const db = new TytaxDatabase(name, deps);
    await db.open();
    return db;
  }

  const logCases: Array<[string, Record<string, unknown>]> = [
    ['exercises missing', { exercises: undefined }],
    ['exercises as an object', { exercises: {} }],
    ['exercises as a string', { exercises: 'bench' }],
    ['exercises: [null]', { exercises: [null] }],
  ];

  it.each(logCases)('a log with %s migrates to a log with no exercises', async (_label, over) => {
    const db = await upgraded({ workoutLogs: [broken(over), v2Log()] });
    const log = await db.workoutLogs.get('log-broken');
    expect(log).toMatchObject({ exercises: [], totalVolumeKg: 0, totalSets: 0, prCount: 0, sessionName: 'Push A' });
    expect((await db.workoutLogs.get('log-1'))?.totalVolumeKg).toBe(2035);
    db.close();
  });

  it('a null entry among a log\'s exercises is dropped; the valid exercise keeps its sets', async () => {
    const db = await upgraded({ workoutLogs: [broken({ exercises: [null, exercise([{ id: 's-1', setNumber: 1, type: 'working', kg: 50, reps: 5, done: true }])] })] });
    const log = await db.workoutLogs.get('log-broken');
    expect(log?.exercises).toHaveLength(1);
    expect(log?.exercises[0]).toMatchObject({ exerciseId: 'bench', sets: [{ id: 's-1', kg: 50, reps: 5, done: true }] });
    expect(log?.totalVolumeKg).toBe(250);
    db.close();
  });

  it('a null set is dropped from its exercise', async () => {
    const db = await upgraded({ workoutLogs: [broken({ exercises: [exercise([null, { id: 's-9', setNumber: 1, type: 'working', kg: 40, reps: 10, done: true }])] })] });
    const log = await db.workoutLogs.get('log-broken');
    expect(log?.exercises[0].sets.map((x) => x.id)).toEqual(['s-9']);
    expect(log?.totalSets).toBe(1);
    expect(log?.totalVolumeKg).toBe(400);
    db.close();
  });

  it('a program with a null session, or a null exercise in a session, migrates without it', async () => {
    const good = v2Program('p-ok');
    const nullSession = { ...v2Program('p-null-session'), sessions: [null, ...good.sessions] };
    const nullExercise = { ...v2Program('p-null-ex'), sessions: good.sessions.map((x) => ({ ...x, exercises: [null, ...x.exercises] })) };
    const db = await upgraded({ programs: [good, nullSession, nullExercise] });
    expect((await db.programs.get('p-null-session'))?.sessions).toHaveLength(good.sessions.length);
    const withEx = await db.programs.get('p-null-ex');
    expect(withEx?.sessions.map((x) => x.exercises.length)).toEqual(good.sessions.map((x) => x.exercises.length));
    expect(withEx?.sessions.flatMap((x) => x.exercises).every((e) => e !== null && typeof e === 'object')).toBe(true);
    db.close();
  });

  it('plateWeights stored as a string falls back to the default plate set', async () => {
    const eq = { ...v2Snapshot().equipmentProfiles![0], id: 'eq-2', profileId: 'u-1', plateWeights: '20,10,5' };
    const db = await upgraded({ profiles: [v2User()], equipmentProfiles: [eq], workoutLogs: [v2Log()] });
    const profile = await db.profiles.get('u-1');
    expect(profile?.settings.plateSetKg).toEqual([...DEFAULT_PROFILE_SETTINGS.plateSetKg]);
    expect(profile?.settings.barWeightKg).toBe(15);
    expect(await db.workoutLogs.count()).toBe(1);
    db.close();
  });
});
