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

export const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
export const isDataRow = (v: unknown): v is DataRow => isObject(v) && typeof v.id === 'string' && v.id !== '';
/** Epoch ms of an ISO stamp; NaN for anything unparseable. */
export const timeOf = (v: unknown): number => (typeof v === 'string' ? Date.parse(v) : Number.NaN);

/** Key-order independent JSON (undefined fields dropped, as IndexedDB does). */
function canonical(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(canonical);
  if (!isObject(v)) return v;
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(v).sort()) if (v[k] !== undefined) out[k] = canonical(v[k]);
  return out;
}

export function sameRow(a: unknown, b: unknown): boolean {
  return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
}
