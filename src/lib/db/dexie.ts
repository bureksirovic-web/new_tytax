import Dexie, { type Table } from 'dexie';
import type { WorkoutLog, PRRecord, BodyweightEntry } from '@/types/workout';
import type { Program } from '@/types/program';
import type { UserProfile, FamilyMember, EquipmentProfile } from '@/types/user';
import type { SyncOperation, SyncMetadata } from '@/types/sync';
import type { Exercise } from '@/types/exercise';

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
  }
}

export const db = new TytaxDatabase();
