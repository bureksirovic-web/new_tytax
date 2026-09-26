/**
 * Dexie v2 row shapes that the frozen contract does not describe (copied from
 * `src/types/*` as of 69cea4e) and the input/output shapes of the v2 -> v3
 * snapshot migration. Migration input only.
 */
import type {
  ArsenalEntry,
  BodyweightEntry,
  EquipmentInventory,
  ExerciseNote,
  ExperienceLevel,
  Gender,
  LegacyProgramV2,
  LegacyUserProfileV2,
  LegacyWorkoutLogV2,
  PRRecord,
  PRType,
  Profile,
  Program,
  WorkoutLog,
} from '@/contracts';

/** v2 `familyMembers` row: a member owned by a user profile (`profileId`). */
export interface LegacyFamilyMemberV2 {
  id: string;
  profileId: string;
  name: string;
  bodyweightKg?: number;
  gender?: Gender;
  experienceLevel?: ExperienceLevel;
  createdAt: string;
}

/** v2 `equipmentProfiles` row (boolean station flags). */
export interface LegacyEquipmentProfileV2 {
  id: string;
  profileId: string;
  name: string;
  hasSmithMachine: boolean;
  hasUpperPulley: boolean;
  hasLowerPulley: boolean;
  hasLegExtension: boolean;
  hasLegCurl: boolean;
  attachments: string[];
  hasPullUpBar: boolean;
  hasDipStation: boolean;
  hasRings: boolean;
  hasParallettes: boolean;
  kettlebellWeights: number[];
  plateWeights: number[];
  barWeightKg: number;
}

/** v2 `prRecords` row (no kg, no timestamps). */
export interface LegacyPRRecordV2 {
  id: string;
  profileId: string;
  exerciseId: string;
  exerciseName: string;
  prType: PRType;
  value: number;
  reps?: number;
  achievedAt: string;
  workoutLogId: string;
}

/** v2 `bodyweightEntries` row (no `updatedAt`). */
export interface LegacyBodyweightEntryV2 {
  id: string;
  profileId: string;
  date: string;
  valueKg: number;
  createdAt: string;
}

/** v2 `exerciseNotes` row (no `createdAt`). */
export interface LegacyExerciseNoteV2 {
  id: string;
  profileId: string;
  exerciseId: string;
  content: string;
  updatedAt: string;
}

/** v2 `arsenal` row: a whole catalog exercise copied in, keyed by its id. */
export interface LegacyArsenalV2 {
  id: string;
  profileId: string;
  addedAt: string;
  name?: string;
}

/**
 * Every table of a Dexie v2 database (v2 table names), each row either the v2
 * shape or an already-migrated v3 shape so the migration can be re-run on its
 * own output. `userProfiles` is accepted as an alias of `profiles`.
 */
export interface SnapshotV2 {
  profiles?: Array<LegacyUserProfileV2 | Profile>;
  userProfiles?: Array<LegacyUserProfileV2 | Profile>;
  familyMembers?: LegacyFamilyMemberV2[];
  equipmentProfiles?: LegacyEquipmentProfileV2[];
  equipment?: EquipmentInventory[];
  workoutLogs?: Array<LegacyWorkoutLogV2 | WorkoutLog>;
  programs?: Array<LegacyProgramV2 | Program>;
  prRecords?: Array<LegacyPRRecordV2 | PRRecord>;
  bodyweightEntries?: Array<LegacyBodyweightEntryV2 | BodyweightEntry>;
  exerciseNotes?: Array<LegacyExerciseNoteV2 | ExerciseNote>;
  arsenal?: Array<LegacyArsenalV2 | ArsenalEntry>;
  /** v2 sync tables: kept in the pre-migration export, dropped from v3. */
  syncQueue?: unknown[];
  syncMetadata?: unknown[];
}

/** v3 tables (names as in `BackupV3`). */
export interface TablesV3 {
  profiles: Profile[];
  workoutLogs: WorkoutLog[];
  programs: Program[];
  prRecords: PRRecord[];
  bodyweightEntries: BodyweightEntry[];
  exerciseNotes: ExerciseNote[];
  arsenal: ArsenalEntry[];
  equipment: EquipmentInventory[];
}

export interface MigrationCtx {
  /** ISO timestamp used only where v2 has no timestamp at all. */
  now: string;
  /** Id for the profile synthesised when v2 has none. Default `crypto.randomUUID()`. */
  newId?: () => string;
  /** Name of that synthesised profile. Default `'Profile'`. */
  defaultProfileName?: string;
}

export interface MigrationResult {
  tables: TablesV3;
  /** The profile to select on this device after the upgrade (null: no profiles). */
  activeProfileId: string | null;
}

export interface PreMigrationExport {
  format: 'tytax-v2-premigration';
  version: 2;
  exportedAt: string;
  tables: Record<string, unknown[]>;
}
