/**
 * Test helpers: a Dexie database declared with the exact v1 + v2 store specs
 * of the shipped app (copied from src/lib/db/dexie.ts), seeding and dumping.
 * Import 'fake-indexeddb/auto' in the test file before this module.
 */
import Dexie from 'dexie';

export const V1_STORES = {
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
};

export const V2_STORES = {
  workoutLogs: 'id, profileId, familyMemberId, programId, date, sessionName, deletedAt, updatedAt',
  syncMetadata: 'id, profileId, tableName, deviceId, schemaVersion',
};

let counter = 0;

/** A unique, deterministic database name per call. */
export function dbName(prefix: string): string {
  counter += 1;
  return `${prefix}-${counter}`;
}

/** The legacy database at version 1 (only v1 stores) or 2 (v1 + v2 stores). */
export function legacyDb(name: string, version: 1 | 2 = 2): Dexie {
  const db = new Dexie(name);
  db.version(1).stores(V1_STORES);
  if (version === 2) db.version(2).stores(V2_STORES);
  return db;
}

export type Rows = Record<string, readonly unknown[] | undefined>;

/** Creates the legacy database, adds every table's rows, closes it. */
export async function seedLegacy(name: string, rows: Rows, version: 1 | 2 = 2): Promise<void> {
  const db = legacyDb(name, version);
  await db.open();
  for (const [table, list] of Object.entries(rows)) {
    if (list && list.length > 0) await db.table(table).bulkAdd([...list]);
  }
  db.close();
}

/** Every table's rows (primary-key order), keyed by table name. */
export async function dump(db: Dexie): Promise<Record<string, unknown[]>> {
  const out: Record<string, unknown[]> = {};
  for (const table of db.tables) out[table.name] = await table.toArray();
  return out;
}

export function sortById<T extends { id: string }>(rows: readonly T[]): T[] {
  return [...rows].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}
