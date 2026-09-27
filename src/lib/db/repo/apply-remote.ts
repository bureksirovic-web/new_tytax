/**
 * `Repository.applyRemote`: pulled rows, last-write-wins on `updatedAt`;
 * never queues outbox rows. A row is skipped (counted in `skipped`) when:
 * - it has no id or no parseable `updatedAt`;
 * - it fails the table's domain schema (src/lib/import/backup-v3, the same
 *   check importBackup runs), so one bad pull cannot break later reads;
 * - it is an `equipment` row whose `id !== profileId` (one inventory per
 *   profile, stored under the profile id; the backup invariant of
 *   src/lib/import/backup-v3/invariants.ts, which the pull path never runs);
 * - the local row belongs to another profile (a pull never moves a row
 *   between profiles; importBackup calls the same case CONFLICT);
 * - the local row is newer, or equally new — except that on an exact tie a
 *   remote tombstone beats a live local row, so deletions converge.
 * Notes and arsenal also keep one live row per (profileId, exerciseId)
 * across ids (./natural-key): an applied remote row that loses the key
 * contest is stored as a tombstone, a local loser is tombstoned in place.
 * Those tombstones are not queued either: every device derives the same
 * bytes from the same pair, and a pending local upsert pushes the tombstone.
 */
import { RepoError } from '@/contracts/repo';
import type { ApplyRemoteResult, SyncTable } from '@/contracts/sync';
import { SYNC_TABLES } from '@/contracts/sync';
import type { RepoContext } from './context';
import { rowProblem, type BackupTableKey } from '@/lib/import/backup-v3/row-check';
import { resolveKeyed } from './natural-key';
import { SYNC_TO_DEXIE, dataTable, isDataRow, timeOf, type DataRow } from './tables';

/** Domain-shape check per table (S3-11); SQL NULL on an optional column counts as absent. */
const SYNC_TO_BACKUP: Readonly<Record<SyncTable, BackupTableKey>> = {
  profiles: 'profiles',
  workout_logs: 'workoutLogs',
  programs: 'programs',
  pr_records: 'prRecords',
  bodyweight_entries: 'bodyweightEntries',
  exercise_notes: 'exerciseNotes',
  arsenal: 'arsenal',
  equipment: 'equipment',
};

function wellFormed(table: SyncTable, row: DataRow): boolean {
  if (table === 'equipment' && row.id !== row.profileId) return false;
  return rowProblem(SYNC_TO_BACKUP[table], row, { nullAsAbsent: true }) === null;
}

function remoteWins(remote: DataRow, local: DataRow | undefined): boolean {
  if (!local) return true;
  const remoteTime = timeOf(remote.updatedAt);
  const localTime = timeOf(local.updatedAt);
  if (remoteTime !== localTime) return !(remoteTime < localTime);
  return Boolean(remote.deletedAt) && !local.deletedAt;
}

export async function applyRemote(ctx: RepoContext, table: SyncTable, records: readonly Record<string, unknown>[]): Promise<ApplyRemoteResult> {
  if (!SYNC_TABLES.includes(table)) throw new RepoError('VALIDATION', `Unknown sync table ${String(table)}`);
  const target = dataTable(ctx.db, SYNC_TO_DEXIE[table]);
  return ctx.write(async () => {
    let applied = 0;
    let skipped = 0;
    for (const remote of records) {
      if (!isDataRow(remote) || !Number.isFinite(timeOf(remote.updatedAt)) || !wellFormed(table, remote)) {
        skipped += 1;
        continue;
      }
      const local = await target.get(remote.id);
      const foreign = local !== undefined && table !== 'profiles' && local.profileId !== remote.profileId;
      if (foreign || !remoteWins(remote, local)) {
        skipped += 1;
        continue;
      }
      const tombs = await resolveKeyed(ctx, SYNC_TO_DEXIE[table], [remote]);
      await target.put(tombs.find((t) => t.id === remote.id) ?? remote);
      for (const t of tombs) if (t.id !== remote.id) await target.put(t);
      applied += 1;
    }
    return { applied, skipped };
  });
}
