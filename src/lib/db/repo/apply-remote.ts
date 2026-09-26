/**
 * `Repository.applyRemote`: pulled rows, last-write-wins on `updatedAt`;
 * never queues outbox rows. A row is skipped (counted in `skipped`) when:
 * - it has no id or no parseable `updatedAt`;
 * - it fails the table's minimal shape (owned tables need a string
 *   `profileId`; workout logs a `date` and an `exercises` array; programs a
 *   `sessions` array), so one bad pull cannot break later reads;
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
import { resolveKeyed } from './natural-key';
import { SYNC_TO_DEXIE, dataTable, isDataRow, timeOf, type DataRow } from './tables';

const hasString = (row: DataRow, key: string): boolean => typeof row[key] === 'string' && row[key] !== '';

function wellFormed(table: SyncTable, row: DataRow): boolean {
  if (table === 'profiles') return true;
  if (!hasString(row, 'profileId')) return false;
  if (table === 'workout_logs') return hasString(row, 'date') && Array.isArray(row.exercises);
  if (table === 'programs') return Array.isArray(row.sessions);
  return true;
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
