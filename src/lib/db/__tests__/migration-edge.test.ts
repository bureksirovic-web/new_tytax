import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import type { LegacyWorkoutLogV2 } from '@/contracts/domain';
import { DEFAULT_DB_NAME, TytaxDatabase, getDb } from '../dexie';
import { PRE_MIGRATION_EXPORT_KEY, clearPreMigrationExport, getPreMigrationExport } from '../migrations';
import { CTX, v2Log, v2Snapshot } from '../migrations/__tests__/fixture';
import { dbName, dump, legacyDb, seedLegacy } from '../migrations/__tests__/v2-db';

const deps = { now: () => new Date(CTX.now), newId: CTX.newId };

describe('Dexie v2 -> v3 upgrade: failure and edge cases', () => {
  it('a throwing transform aborts the upgrade and leaves the v2 database intact', async () => {
    const name = dbName('mig-fail');
    // `exercises: [null]`: isV3Log reads `.uid` of null and the transform throws.
    const bad = { ...v2Log(), id: 'log-bad', exercises: [null] } as unknown as LegacyWorkoutLogV2;
    const seeded = { ...v2Snapshot(), workoutLogs: [v2Log(), bad] };
    await seedLegacy(name, seeded);
    const legacyBefore = legacyDb(name);
    await legacyBefore.open();
    const before = await dump(legacyBefore);
    legacyBefore.close();

    const db = new TytaxDatabase(name, deps);
    await expect(db.open()).rejects.toThrow(/reading 'uid'/);
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
