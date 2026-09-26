/**
 * Dexie v2 -> v3 upgrade: the thin Dexie side of the pure transforms in
 * `./migrations/` (AC18).
 *
 * Inside the versionchange transaction the upgrade:
 * 1. reads every v2 table into a `SnapshotV2`;
 * 2. stores the automatic pre-migration export (`buildPreMigrationExport`) as
 *    the `meta` row `preMigrationExport.v2`, before anything is rewritten;
 * 3. runs `migrateSnapshotV2toV3` and rewrites each v3 table (clear + bulkPut);
 * 4. sets `meta.activeProfileId` when derivable and none is set;
 * 5. drops v2-shaped outbox rows (v2 op shape is not drainable by v3).
 *
 * Any throw aborts the versionchange transaction: Dexie rolls back and the
 * database stays at v2 with its data intact. Running the upgrade over rows
 * that are already v3 changes nothing (the transforms are idempotent, an
 * existing export and active profile are kept, v3 outbox rows are kept).
 */
import Dexie, { type Table, type Transaction } from 'dexie';
import type { MetaRow } from './dexie';
import { buildPreMigrationExport, migrateSnapshotV2toV3 } from './migrations/index';
import type { LegacyDeviceSettings, PreMigrationExport, SnapshotV2, TablesV3 } from './migrations/index';

/** `meta` key of the automatic pre-migration JSON export. */
export const PRE_MIGRATION_EXPORT_KEY = 'preMigrationExport.v2';
/** `meta` key of the selected profile; must equal `ACTIVE_PROFILE_KEY` in ./repo/profiles. */
export const ACTIVE_PROFILE_META_KEY = 'activeProfileId';

/** Every v2 table (plus v3 `equipment`, read so a re-run over v3 rows keeps it). */
const SNAPSHOT_TABLES = [
  'profiles',
  'familyMembers',
  'equipmentProfiles',
  'equipment',
  'workoutLogs',
  'programs',
  'prRecords',
  'bodyweightEntries',
  'arsenal',
  'exerciseNotes',
  'syncQueue',
  'syncMetadata',
] as const;

export interface UpgradeDeps {
  /** Clock for the export stamp and rows with no usable timestamp. */
  now: () => Date;
  /** Id for a synthesised primary profile. Default `newUuid()` (./ids). */
  newId?: () => string;
  /** v2 localStorage settings, read once per upgrade. Absent: contract defaults. */
  legacyDeviceSettings?: () => LegacyDeviceSettings | undefined;
}

/**
 * Rows of one store. Tables this version deletes (`null` spec) are absent from
 * Dexie's `tx.storeNames` but still exist in the IndexedDB versionchange
 * transaction until it commits, so they are read natively. `Dexie.Promise`
 * keeps the upgrade's transaction zone alive across the await.
 */
function readStore(tx: Transaction, name: string): Promise<unknown[]> | null {
  if (tx.storeNames.includes(name)) return tx.table(name).toArray();
  if (!tx.idbtrans.objectStoreNames.contains(name)) return null;
  const request = tx.idbtrans.objectStore(name).getAll();
  return new Dexie.Promise<unknown[]>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readSnapshot(tx: Transaction): Promise<SnapshotV2> {
  const snapshot: Record<string, unknown[]> = {};
  for (const name of SNAPSHOT_TABLES) {
    const pending = readStore(tx, name);
    const rows = pending === null ? null : await pending;
    // v3-only `equipment` is empty on a real v2 database: keep it out of the export.
    if (rows !== null && (name !== 'equipment' || rows.length > 0)) snapshot[name] = rows;
  }
  // Rows are untyped IndexedDB data; the transforms coerce every field they read.
  return snapshot as SnapshotV2;
}

async function writeTables(tx: Transaction, tables: TablesV3): Promise<void> {
  for (const [name, rows] of Object.entries(tables) as Array<[keyof TablesV3, TablesV3[keyof TablesV3]]>) {
    const table = tx.table(name);
    await table.clear();
    await table.bulkPut(rows);
  }
}

function isV3Operation(row: unknown): boolean {
  return typeof row === 'object' && row !== null && typeof (row as { table?: unknown }).table === 'string';
}

/** The v3 `upgrade()` callback, with injectable clock and id source. */
export function createV3Upgrade(deps: UpgradeDeps): (tx: Transaction) => Promise<void> {
  return async (tx) => {
    const snapshot = await readSnapshot(tx);
    const now = deps.now().toISOString();
    const meta = tx.table<MetaRow, string>('meta');

    // Backup first, so it exists whenever any v3 row does. Never overwritten:
    // the first export is the one holding the original v2 data.
    if ((await meta.get(PRE_MIGRATION_EXPORT_KEY)) === undefined) {
      await meta.put({ key: PRE_MIGRATION_EXPORT_KEY, value: buildPreMigrationExport(snapshot, now) });
    }

    const result = migrateSnapshotV2toV3(snapshot, {
      now,
      newId: deps.newId,
      legacyDeviceSettings: deps.legacyDeviceSettings?.(),
    });
    await writeTables(tx, result.tables);

    if (result.activeProfileId !== null && (await meta.get(ACTIVE_PROFILE_META_KEY)) === undefined) {
      await meta.put({ key: ACTIVE_PROFILE_META_KEY, value: result.activeProfileId });
    }

    await tx
      .table('syncQueue')
      .filter((row: unknown) => !isV3Operation(row))
      .delete();
  };
}

function isPreMigrationExport(value: unknown): value is PreMigrationExport {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Partial<PreMigrationExport>;
  return v.format === 'tytax-v2-premigration' && v.version === 2 && typeof v.exportedAt === 'string' && typeof v.tables === 'object' && v.tables !== null;
}

interface MetaStore {
  meta: Table<MetaRow, string>;
}

/** The automatic pre-migration export, or null when there is none (fresh install, or cleared). */
export async function getPreMigrationExport(db: MetaStore): Promise<PreMigrationExport | null> {
  const row = await db.meta.get(PRE_MIGRATION_EXPORT_KEY);
  return row !== undefined && isPreMigrationExport(row.value) ? row.value : null;
}

/** Deletes the pre-migration export (after the user has downloaded or dismissed it). */
export async function clearPreMigrationExport(db: MetaStore): Promise<void> {
  await db.meta.delete(PRE_MIGRATION_EXPORT_KEY);
}

export type { PreMigrationExport } from './migrations/index';
