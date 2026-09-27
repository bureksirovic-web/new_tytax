/**
 * Bulk data movement: JSON backup export/import, remote LWW apply, outbox,
 * and the test-only wipe.
 */
import { RepoError, type BackupV3 } from '@/contracts/repo';
import type { ApplyRemoteResult, SyncOperation, SyncOutbox, SyncTable } from '@/contracts/sync';
import { SYNC_TABLES } from '@/contracts/sync';
import type { RepoContext } from './context';
import { SYNC_TO_DEXIE, dataTable, type DataRow, type DataTableName } from './tables';

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

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isDataRow(v: unknown): v is DataRow {
  return isObject(v) && typeof v.id === 'string' && v.id !== '';
}

function timeOf(v: unknown): number {
  return typeof v === 'string' ? Date.parse(v) : Number.NaN;
}

export async function exportBackup(ctx: RepoContext, profileId?: string): Promise<BackupV3> {
  const db = ctx.db;
  return db.transaction('r', db.tables, async () => {
    const backup: BackupV3 = {
      format: 'tytax-backup',
      version: 3,
      exportedAt: ctx.stamp(),
      profiles: [],
      workoutLogs: [],
      programs: [],
      prRecords: [],
      bodyweightEntries: [],
      exerciseNotes: [],
      arsenal: [],
      equipment: [],
    };
    if (profileId !== undefined) {
      const profile = await db.profiles.get(profileId);
      if (!profile) throw new RepoError('NOT_FOUND', `Profile ${profileId} not found`);
      backup.profiles = [profile];
    } else {
      backup.profiles = await db.profiles.toArray();
    }
    backup.workoutLogs = await rowsOf(db.workoutLogs, profileId);
    backup.programs = await rowsOf(db.programs, profileId);
    backup.prRecords = await rowsOf(db.prRecords, profileId);
    backup.bodyweightEntries = await rowsOf(db.bodyweightEntries, profileId);
    backup.exerciseNotes = await rowsOf(db.exerciseNotes, profileId);
    backup.arsenal = await rowsOf(db.arsenal, profileId);
    backup.equipment = await rowsOf(db.equipment, profileId);
    return backup;
  });
}

interface ProfileScoped<T> {
  toArray(): Promise<T[]>;
  where(index: string): { equals(key: string): { toArray(): Promise<T[]> } };
}

function rowsOf<T>(table: ProfileScoped<T>, profileId?: string): Promise<T[]> {
  return profileId === undefined ? table.toArray() : table.where('profileId').equals(profileId).toArray();
}

function validateBackup(backup: unknown): asserts backup is BackupV3 {
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
  }
}

export async function importBackup(ctx: RepoContext, backup: BackupV3): Promise<{ inserted: number; updated: number }> {
  validateBackup(backup);
  return ctx.write(async (w) => {
    const profileIds = new Set<string>([...backup.profiles.map((p) => p.id), ...(await ctx.db.profiles.toCollection().primaryKeys())]);
    let inserted = 0;
    let updated = 0;
    for (const [key, name, syncName] of BACKUP_TABLES) {
      const rows = backup[key] as unknown as DataRow[];
      if (rows.length === 0) continue;
      const orphan = rows.find((r) => key !== 'profiles' && !profileIds.has(String(r.profileId)));
      if (orphan) throw new RepoError('VALIDATION', `Backup ${key} row ${orphan.id} belongs to an unknown profile`);
      const table = dataTable(ctx.db, name);
      const existing = await table.bulkGet(rows.map((r) => r.id));
      existing.forEach((row) => (row ? (updated += 1) : (inserted += 1)));
      await table.bulkPut(rows);
      for (const r of rows) await w.queue(syncName, 'upsert', r.id, key === 'profiles' ? r.id : String(r.profileId));
    }
    return { inserted, updated };
  });
}

/** Pulled rows, last-write-wins on `updatedAt`; never queues outbox rows. */
export async function applyRemote(ctx: RepoContext, table: SyncTable, records: readonly Record<string, unknown>[]): Promise<ApplyRemoteResult> {
  if (!SYNC_TABLES.includes(table)) throw new RepoError('VALIDATION', `Unknown sync table ${String(table)}`);
  const target = dataTable(ctx.db, SYNC_TO_DEXIE[table]);
  return ctx.write(async () => {
    let applied = 0;
    let skipped = 0;
    for (const remote of records) {
      const remoteTime = timeOf(remote?.updatedAt);
      if (!isDataRow(remote) || !Number.isFinite(remoteTime)) {
        skipped += 1;
        continue;
      }
      const local = await target.get(remote.id);
      const localTime = timeOf(local?.updatedAt);
      if (local && Number.isFinite(localTime) && remoteTime <= localTime) {
        skipped += 1;
        continue;
      }
      await target.put(remote);
      applied += 1;
    }
    return { applied, skipped };
  });
}

export function createOutbox(ctx: RepoContext): SyncOutbox {
  return {
    peek: (limit) => ctx.db.syncQueue.orderBy('createdAt').limit(Math.max(0, Math.floor(limit))).toArray(),
    async ack(ids) {
      await ctx.db.syncQueue.bulkDelete([...ids]);
    },
    async fail(id, error) {
      await ctx.db.syncQueue.where('id').equals(id).modify((op: SyncOperation) => {
        op.retryCount = (op.retryCount ?? 0) + 1;
        op.lastError = error;
      });
    },
    count: () => ctx.db.syncQueue.count(),
  };
}

export async function resetAll(ctx: RepoContext): Promise<void> {
  await ctx.write(async () => {
    for (const table of ctx.db.tables) await table.clear();
  });
}
