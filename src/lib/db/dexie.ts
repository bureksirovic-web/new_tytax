import Dexie, { type Table } from 'dexie';
import type { WorkoutLog, PRRecord, BodyweightEntry } from '@/types/workout';
import type { Program } from '@/types/program';
import type { UserProfile, FamilyMember, EquipmentProfile } from '@/types/user';
import type { SyncOperation, SyncMetadata } from '@/types/sync';
import type { Exercise } from '@/types/exercise';

/**
 * Current database schema version.
 * Increment this constant when adding new version() blocks below.
 * Each version() call is cumulative in Dexie — it inherits all previous
 * table definitions, so you only need to list tables whose indexes change.
 */
export const DB_VERSION = 2;

export interface ArsenalExercise extends Exercise {
  profileId: string;
  addedAt: string;
}

export interface ExerciseNote {
  id: string;
  profileId: string;
  exerciseId: string;
  content: string;
  updatedAt: string;
}

export class TytaxDatabase extends Dexie {
  // User
  profiles!: Table<UserProfile, string>;
  familyMembers!: Table<FamilyMember, string>;
  equipmentProfiles!: Table<EquipmentProfile, string>;

  // Training
  workoutLogs!: Table<WorkoutLog, string>;
  prRecords!: Table<PRRecord, string>;
  programs!: Table<Program, string>;
  bodyweightEntries!: Table<BodyweightEntry, string>;

  // Exercises
  arsenal!: Table<ArsenalExercise, string>;
  exerciseNotes!: Table<ExerciseNote, string>;

  // Sync
  syncQueue!: Table<SyncOperation, string>;
  syncMetadata!: Table<SyncMetadata, string>;

  constructor() {
    super('TytaxDB');

    // ─────────────────────────────────────────────────────────────
    // MIGRATION STRATEGY
    // ─────────────────────────────────────────────────────────────
    // Dexie migrations are additive: each version() call inherits
    // every table from the previous version. Only list tables whose
    // index spec actually changes in a given version block.
    //
    // To add a new schema version:
    //   1. Increment DB_VERSION above.
    //   2. Add `this.version(N).stores({ ... })` with only the
    //      tables whose indexes are new or changed.
    //   3. Chain `.upgrade(async (tx) => { ... })` to perform any
    //      data transformations (e.g., backfilling new fields).
    //   4. Update any TypeScript interfaces so new fields are typed.
    //
    // Important rules:
    //   - Never remove or rename an index without a proper migration.
    //   - The upgrade function runs inside a single transaction, so
    //     all reads/writes must use `tx.table('...')` — NOT `this`.
    //   - If a migration can be slow, consider chunking with
    //     `.modify()` on subsets or Dexie's bulk operations.
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
      await tx.table('workoutLogs').toCollection().modify((record: WorkoutLog & { updatedAt?: string }) => {
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
        schemaVersion: 2,
      } as SyncMetadata & { schemaVersion: number });
    });
  }
}

export const db = new TytaxDatabase();
