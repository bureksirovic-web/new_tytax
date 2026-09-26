import Dexie, { type Table } from 'dexie';
import type {
  ArsenalEntry,
  BodyweightEntry,
  EquipmentInventory,
  ExerciseNote,
  PRRecord,
  Profile,
  Program,
  WorkoutLog,
} from '@/contracts/domain';
import type { SyncCursor, SyncOperation } from '@/contracts/sync';
import { migrateToV3 } from './migrations';

/**
 * Current database schema version.
 * Increment this constant when adding new version() blocks below.
 * Each version() call is cumulative in Dexie — it inherits all previous
 * table definitions, so you only need to list tables whose indexes change.
 */
export const DB_VERSION = 3;

/** Default IndexedDB database name. */
export const DEFAULT_DB_NAME = 'TytaxDB';

/** Device-local key/value row (`meta` table), e.g. `activeProfileId`. */
export interface MetaRow {
  key: string;
  value: unknown;
}

export class TytaxDatabase extends Dexie {
  // Profiles and profile-owned records (v3 shapes, see src/contracts/domain.ts)
  profiles!: Table<Profile, string>;
  workoutLogs!: Table<WorkoutLog, string>;
  programs!: Table<Program, string>;
  prRecords!: Table<PRRecord, string>;
  bodyweightEntries!: Table<BodyweightEntry, string>;
  exerciseNotes!: Table<ExerciseNote, string>;
  arsenal!: Table<ArsenalEntry, string>;
  equipment!: Table<EquipmentInventory, string>;

  // Sync
  syncQueue!: Table<SyncOperation, string>;
  syncCursors!: Table<SyncCursor, string>;

  // Device-local settings
  meta!: Table<MetaRow, string>;

  constructor(name: string = DEFAULT_DB_NAME) {
    super(name);

    // ─────────────────────────────────────────────────────────────
    // MIGRATION STRATEGY
    // ─────────────────────────────────────────────────────────────
    // Dexie migrations are additive: each version() call inherits
    // every table from the previous version. Only list tables whose
    // index spec actually changes in a given version block; `null`
    // deletes a table (it stays readable inside that version's
    // upgrade function and is dropped afterwards).
    //
    // Important rules:
    //   - Never change a primary key (Dexie cannot); v1/v2 specs below
    //     stay byte-for-byte so existing installs upgrade.
    //   - The upgrade function runs inside the version-change
    //     transaction: use `tx.table('...')`, never `this`.
    // ─────────────────────────────────────────────────────────────

    // v1 — Initial schema (all tables + indexes)
    this.version(1).stores({
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

    // v2 — Add updatedAt index on workoutLogs for conflict resolution;
    //       track schemaVersion in syncMetadata for easier future migrations.
    this.version(2).stores({
      workoutLogs: 'id, profileId, familyMemberId, programId, date, sessionName, deletedAt, updatedAt',
      syncMetadata: 'id, profileId, tableName, deviceId, schemaVersion',
    }).upgrade(async (tx) => {
      // Backfill updatedAt on existing workoutLog records.
      await tx.table('workoutLogs').toCollection().modify((record: Record<string, unknown>) => {
        if (!record.updatedAt) {
          record.updatedAt = record.createdAt || new Date().toISOString();
        }
      });

      // Seed a schemaVersion marker in syncMetadata so future migrations
      // can quickly detect the current schema without querying Dexie internals.
      await tx.table('syncMetadata').put({
        id: 'schema_version',
        profileId: '',
        tableName: '',
        deviceId: '',
        lastSyncedAt: new Date().toISOString(),
        schemaVersion: 2,
      });
    });

    // v3 — TYTAX v2 contracts: profile-scoped compound indexes, activeProgramId
    //       on the profile (no boolean index), new outbox shape, meta table.
    this.version(3).stores({
      profiles: 'id, accountId, updatedAt',
      workoutLogs: 'id, profileId, [profileId+date], programId, updatedAt',
      programs: 'id, profileId, updatedAt',
      prRecords: 'id, profileId, [profileId+exerciseId], workoutLogId, updatedAt',
      bodyweightEntries: 'id, profileId, [profileId+date], updatedAt',
      exerciseNotes: 'id, profileId, [profileId+exerciseId], updatedAt',
      arsenal: 'id, profileId, [profileId+exerciseId], updatedAt',
      equipment: 'id, profileId, updatedAt',
      syncQueue: 'id, table, createdAt, recordId',
      syncCursors: 'table',
      syncMetadata: null,
      meta: 'key',
      familyMembers: null,
      equipmentProfiles: null,
    }).upgrade(migrateToV3);
  }
}

let instance: TytaxDatabase | undefined;

/**
 * The app database, constructed on first use. Never construct Dexie at module
 * import time: server rendering imports this module.
 */
export function getDb(): TytaxDatabase {
  if (!instance) instance = new TytaxDatabase();
  return instance;
}
