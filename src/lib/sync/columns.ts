/**
 * Explicit per-table column maps (docs/v2/sync-schema.md is the source of
 * truth). camelCase field ↔ snake_case column. `id`, the owner columns
 * (`profile_id`, `family_member_id`) and `extra` are handled by the mapper.
 */
import type { SyncTable } from '@/contracts/sync';

export type ColumnPair = readonly [camel: string, snake: string];

export interface TableSpec {
  /** Remote (Supabase) table name. */
  readonly remote: string;
  /** `account`: the row is a family member (`accountId` ↔ `profile_id`). `member`: `profileId` ↔ `family_member_id`. */
  readonly owner: 'account' | 'member';
  readonly columns: readonly ColumnPair[];
  /** camelCase fields holding foreign-key uuids (validated when not null). */
  readonly fkIds: readonly string[];
}

const TIMESTAMPS: readonly ColumnPair[] = [
  ['createdAt', 'created_at'],
  ['updatedAt', 'updated_at'],
  ['deletedAt', 'deleted_at'],
];

export const TABLE_SPECS: Readonly<Record<SyncTable, TableSpec>> = Object.freeze({
  profiles: {
    remote: 'family_members',
    owner: 'account',
    columns: [
      ['name', 'name'],
      ['avatarColor', 'avatar_color'],
      ['activeProgramId', 'active_program_id'],
      ['settings', 'settings'],
      ['bodyweightKg', 'bodyweight_kg'],
      ['gender', 'gender'],
      ['experienceLevel', 'experience_level'],
      ...TIMESTAMPS,
    ],
    fkIds: ['activeProgramId'],
  },
  workout_logs: {
    remote: 'workout_logs',
    owner: 'member',
    columns: [
      ['programId', 'program_id'],
      ['programSessionId', 'program_session_id'],
      ['sessionName', 'session_name'],
      ['date', 'date'],
      ['startedAt', 'started_at'],
      ['finishedAt', 'finished_at'],
      ['durationSeconds', 'duration_seconds'],
      ['exercises', 'exercises'],
      ['notes', 'notes'],
      ['rpe', 'rpe'],
      ['bodyweightKg', 'bodyweight_kg'],
      ['totalVolumeKg', 'total_volume_kg'],
      ['totalSets', 'total_sets'],
      ['prCount', 'pr_count'],
      ['modalitiesUsed', 'modalities_used'],
      ['isDeload', 'is_deload'],
      ...TIMESTAMPS,
    ],
    fkIds: ['programId'],
  },
  programs: {
    remote: 'programs',
    owner: 'member',
    columns: [
      ['name', 'name'],
      ['splitType', 'split_type'],
      ['frequency', 'frequency'],
      ['periodizationType', 'periodization_type'],
      ['periodizationConfig', 'periodization_config'],
      ['sessionOrder', 'session_order'],
      ['sessions', 'sessions'],
      ['modalitiesUsed', 'modalities_used'],
      ['isPreset', 'is_preset'],
      ['presetId', 'preset_id'],
      ['currentSessionIndex', 'current_session_index'],
      ['rotationStartDate', 'rotation_start_date'],
      ...TIMESTAMPS,
    ],
    fkIds: [],
  },
  pr_records: {
    remote: 'pr_records',
    owner: 'member',
    columns: [
      ['exerciseId', 'exercise_id'],
      ['exerciseName', 'exercise_name'],
      ['prType', 'pr_type'],
      ['value', 'value'],
      ['kg', 'kg'],
      ['reps', 'reps'],
      ['achievedAt', 'achieved_at'],
      ['workoutLogId', 'workout_log_id'],
      ['setId', 'set_id'],
      ['isBaseline', 'is_baseline'],
      ...TIMESTAMPS,
    ],
    fkIds: ['workoutLogId'],
  },
  bodyweight_entries: {
    remote: 'bodyweight_entries',
    owner: 'member',
    columns: [['date', 'date'], ['valueKg', 'value_kg'], ...TIMESTAMPS],
    fkIds: [],
  },
  exercise_notes: {
    remote: 'exercise_notes',
    owner: 'member',
    columns: [['exerciseId', 'exercise_id'], ['content', 'content'], ...TIMESTAMPS],
    fkIds: [],
  },
  // ArsenalEntry has no createdAt: the server's created_at is server-only (sync-schema.md).
  arsenal: {
    remote: 'arsenal',
    owner: 'member',
    columns: [
      ['exerciseId', 'exercise_id'],
      ['addedAt', 'added_at'],
      ['updatedAt', 'updated_at'],
      ['deletedAt', 'deleted_at'],
    ],
    fkIds: [],
  },
  equipment: {
    remote: 'equipment',
    owner: 'member',
    columns: [
      ['stationIds', 'station_ids'],
      ['attachmentIds', 'attachment_ids'],
      ['kettlebellsKg', 'kettlebells_kg'],
      ['bodyweightGear', 'bodyweight_gear'],
      ...TIMESTAMPS,
    ],
    fkIds: [],
  },
});

/** Parents first: every REST call is its own transaction, so FK parents must already exist. */
export const PUSH_ORDER: readonly SyncTable[] = Object.freeze([
  'profiles',
  'programs',
  'workout_logs',
  'pr_records',
  'bodyweight_entries',
  'exercise_notes',
  'arsenal',
  'equipment',
]);

/** timestamptz columns: pulled values are normalised to `Date#toISOString()` ('Z', ms). */
export const TIMESTAMP_COLUMNS: ReadonlySet<string> = new Set([
  'created_at',
  'updated_at',
  'deleted_at',
  'started_at',
  'finished_at',
  'achieved_at',
  'added_at',
]);

export function remoteTableOf(table: SyncTable): string {
  return TABLE_SPECS[table].remote;
}
