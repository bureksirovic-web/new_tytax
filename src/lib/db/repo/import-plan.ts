/**
 * importBackup planning: shape checks and the read-only pass that decides
 * which rows are written. Nothing here writes.
 *
 * - Last-write-wins on `updatedAt`: an incoming row strictly OLDER than the
 *   local row is skipped (a newer local edit is never clobbered). A tie is
 *   applied only when the content differs, so re-importing an identical
 *   backup writes nothing, queues nothing and reports `updated: 0`.
 *   An incoming row without a parseable `updatedAt` never beats a local row.
 * - Shape: every row of every table must match its domain schema
 *   (src/lib/import/backup-v3) or the whole import is VALIDATION (S3-11).
 * - Owners: owned rows must name a profile in the backup or the DB (else
 *   VALIDATION). Rows whose profile ends the import tombstoned are skipped
 *   (not written, not counted): they could never be read, only synced.
 * - A row id existing under ANOTHER profile is CONFLICT; `activeProgramId`
 *   must name a program of the same profile (backup or DB); duplicate ids in
 *   one table are VALIDATION.
 * - Notes and arsenal keep one live row per (profileId, exerciseId) even when
 *   backup and local ids differ (./natural-key): the losing row is written as
 *   a tombstone under its own id and counted like any other written row.
 */
import { RepoError, type BackupV3 } from '@/contracts/repo';
import type { SyncTable } from '@/contracts/sync';
import type { RepoContext } from './context';
import { rowProblem } from '@/lib/import/backup-v3/row-check';
import { resolveKeyed } from './natural-key';
import { dataTable, isDataRow, isObject, sameRow, timeOf, type DataRow, type DataTableName } from './tables';

type BackupKey = Exclude<keyof BackupV3, 'format' | 'version' | 'exportedAt'>;

/** Backup array → Dexie table, profiles first so ownership checks can see them. */
const BACKUP_TABLES: ReadonlyArray<readonly [BackupKey, DataTableName, SyncTable]> = [
  ['profiles', 'profiles', 'profiles'],
  ['programs', 'programs', 'programs'],
  ['workoutLogs', 'workoutLogs', 'workout_logs'],
  ['prRecords', 'prRecords', 'pr_records'],
  ['bodyweightEntries', 'bodyweightEntries', 'bodyweight_entries'],
  ['exerciseNotes', 'exerciseNotes', 'exercise_notes'],
  ['arsenal', 'arsenal', 'arsenal'],
  ['equipment', 'equipment', 'equipment'],
];

export interface TablePlan {
  name: DataTableName;
  syncName: SyncTable;
  isProfiles: boolean;
  write: DataRow[];
  inserted: number;
}

export function validateBackup(backup: unknown): asserts backup is BackupV3 {
  if (!isObject(backup) || backup.format !== 'tytax-backup' || backup.version !== 3) {
    throw new RepoError('VALIDATION', 'Not a tytax-backup version 3 file');
  }
  for (const [key] of BACKUP_TABLES) {
    const rows = backup[key];
    if (!Array.isArray(rows) || !rows.every(isDataRow)) {
      throw new RepoError('VALIDATION', `Backup field ${key} must be an array of records with ids`);
    }
    if (key !== 'profiles' && !rows.every((r) => typeof r.profileId === 'string')) {
      throw new RepoError('VALIDATION', `Backup field ${key} has a record without profileId`);
    }
    rows.forEach((row, i) => {
      const problem = rowProblem(key, row);
      if (problem) throw new RepoError('VALIDATION', `Backup ${key}[${i}] (id ${String(row.id)}) is malformed: ${problem}`);
    });
    if (new Set(rows.map((r) => r.id)).size !== rows.length) {
      throw new RepoError('VALIDATION', `Backup field ${key} has duplicate ids`);
    }
  }
}

/** LWW: newer wins; a tie wins only with different content; NaN incoming never beats a timed local row. */
function incomingWins(row: DataRow, local: DataRow | undefined): boolean {
  if (!local) return true;
  const localTime = timeOf(local.updatedAt);
  const time = timeOf(row.updatedAt);
  if (Number.isFinite(localTime) && time > localTime) return true;
  if (Number.isFinite(localTime) && time !== localTime) return false;
  return !sameRow(row, local);
}

/** Profile ids live after the profiles plan is applied (backup row if it wins, else the DB row). */
async function liveOwners(ctx: RepoContext, profilePlan: TablePlan): Promise<Set<string>> {
  const final = new Map<string, DataRow>();
  for (const p of await dataTable(ctx.db, 'profiles').toArray()) final.set(p.id, p);
  for (const p of profilePlan.write) final.set(p.id, p);
  return new Set([...final.values()].filter((p) => !p.deletedAt).map((p) => p.id));
}

async function planTable(ctx: RepoContext, key: BackupKey, name: DataTableName, syncName: SyncTable, rows: DataRow[], live?: Set<string>): Promise<TablePlan> {
  const isProfiles = key === 'profiles';
  const existing = await dataTable(ctx.db, name).bulkGet(rows.map((r) => r.id));
  const plan: TablePlan = { name, syncName, isProfiles, write: [], inserted: 0 };
  rows.forEach((row, i) => {
    const local = existing[i];
    if (local && !isProfiles && local.profileId !== row.profileId) {
      throw new RepoError('CONFLICT', `Backup ${key} row ${row.id} exists under another profile`);
    }
    if (live && !live.has(String(row.profileId))) return;
    if (!incomingWins(row, local)) return;
    if (!local) plan.inserted += 1;
    plan.write.push(row);
  });
  for (const tomb of await resolveKeyed(ctx, name, plan.write)) {
    const at = plan.write.findIndex((r) => r.id === tomb.id);
    if (at >= 0) plan.write[at] = tomb;
    else plan.write.push(tomb);
  }
  return plan;
}

/** Reads only: decides which rows win and rejects bad references before anything is written. */
export async function planImport(ctx: RepoContext, backup: BackupV3): Promise<TablePlan[]> {
  const known = new Set<string>([...backup.profiles.map((p) => p.id), ...(await ctx.db.profiles.toCollection().primaryKeys())]);
  const plans: TablePlan[] = [];
  let live: Set<string> | undefined;
  for (const [key, name, syncName] of BACKUP_TABLES) {
    const rows = backup[key] as unknown as DataRow[];
    const orphan = key === 'profiles' ? undefined : rows.find((r) => !known.has(String(r.profileId)));
    if (orphan) throw new RepoError('VALIDATION', `Backup ${key} row ${orphan.id} belongs to an unknown profile`);
    const plan = await planTable(ctx, key, name, syncName, rows, live);
    if (key === 'profiles') live = await liveOwners(ctx, plan);
    plans.push(plan);
  }
  await assertActivePrograms(ctx, backup);
  return plans;
}

async function assertActivePrograms(ctx: RepoContext, backup: BackupV3): Promise<void> {
  for (const profile of backup.profiles) {
    const active = profile.activeProgramId;
    if (active === null || active === undefined) continue;
    const owner = backup.programs.find((p) => p.id === active)?.profileId ?? (await ctx.db.programs.get(active))?.profileId;
    if (owner !== profile.id) {
      throw new RepoError('VALIDATION', `Profile ${profile.id} activeProgramId ${active} is not one of its programs`);
    }
  }
}
