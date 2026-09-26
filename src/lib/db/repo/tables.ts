import type { Table } from 'dexie';
import type { SyncTable } from '@/contracts/sync';
import type { TytaxDatabase } from '../dexie';

/** Dexie table names that hold user data (everything except sync/meta bookkeeping). */
export type DataTableName =
  | 'profiles'
  | 'workoutLogs'
  | 'programs'
  | 'prRecords'
  | 'bodyweightEntries'
  | 'exerciseNotes'
  | 'arsenal'
  | 'equipment';

export const SYNC_TO_DEXIE: Readonly<Record<SyncTable, DataTableName>> = Object.freeze({
  profiles: 'profiles',
  workout_logs: 'workoutLogs',
  programs: 'programs',
  pr_records: 'prRecords',
  bodyweight_entries: 'bodyweightEntries',
  exercise_notes: 'exerciseNotes',
  arsenal: 'arsenal',
  equipment: 'equipment',
});

/** Profile-owned tables, children first (the order a profile wipe walks them). */
export const OWNED_TABLES: ReadonlyArray<readonly [DataTableName, SyncTable]> = Object.freeze([
  ['prRecords', 'pr_records'],
  ['workoutLogs', 'workout_logs'],
  ['bodyweightEntries', 'bodyweight_entries'],
  ['exerciseNotes', 'exercise_notes'],
  ['arsenal', 'arsenal'],
  ['equipment', 'equipment'],
  ['programs', 'programs'],
] as const);

/** The common shape of every user-data row. */
export interface DataRow {
  id: string;
  profileId?: string;
  updatedAt?: string;
  deletedAt?: string;
  [key: string]: unknown;
}

export function dataTable(db: TytaxDatabase, name: DataTableName): Table<DataRow, string> {
  return db.table<DataRow, string>(name);
}
