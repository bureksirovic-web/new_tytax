/**
 * Restore guards that need the device's rows, including soft-deleted ones
 * (repo.profiles.get hides tombstones; repo.exportBackup(id) does not).
 */
import { isRepoError, type BackupV3, type Repository } from '@/contracts';
import { isDataRow, sameRow, timeOf, type DataRow } from '@/lib/db/repo/tables';
import { hasClampedStamp } from '../backup-v3/future-stamps';
import type { BackupOwnedTable } from './types';

export const OWNED: readonly BackupOwnedTable[] = ['workoutLogs', 'programs', 'prRecords', 'bodyweightEntries', 'exerciseNotes', 'arsenal', 'equipment'];

/** This device's copy of one profile (tombstoned rows included), or undefined when it never had it. */
export async function localCopy(repo: Repository, profileId: string): Promise<BackupV3 | undefined> {
  try {
    return await repo.exportBackup(profileId);
  } catch (e) {
    if (isRepoError(e, 'NOT_FOUND')) return undefined;
    throw e;
  }
}

/** Would importBackup write `incoming` over `local`? Mirrors the LWW rule of src/lib/db/repo/import-plan.ts. */
export function wins(incoming: DataRow, local: DataRow): boolean {
  const localTime = timeOf(local.updatedAt);
  const time = timeOf(incoming.updatedAt);
  if (Number.isFinite(localTime) && time > localTime) return true;
  if (Number.isFinite(localTime) && time !== localTime) return false;
  return !sameRow(incoming, local);
}

export const rowWins = (incoming: unknown, local: unknown): boolean => isDataRow(incoming) && isDataRow(local) && wins(incoming, local);

/**
 * Backup profile ids that are deleted (tombstoned) on this device and whose
 * file row wins LWW, so the restore would bring the profile and its rows back.
 */
export async function resurrectedIds(repo: Repository, backup: BackupV3, liveIds: readonly string[]): Promise<string[]> {
  const out: string[] = [];
  for (const p of backup.profiles) {
    if (liveIds.includes(p.id)) continue;
    const local = (await localCopy(repo, p.id))?.profiles[0];
    if (local?.deletedAt && !p.deletedAt && rowWins(p, local)) out.push(p.id);
  }
  return out;
}

/**
 * The backup without rows whose far-future stamp was clamped to "now" and whose
 * id this device already has (live or deleted). The clamp stamp is the restore
 * clock, so such a row would beat every local edit made since the previous
 * restore of the same file and be written again each time (future-stamps.ts).
 * A clamped row with a new id is still added. Returns `backup` when nothing was clamped.
 */
export async function withoutPinnedRows(repo: Repository, backup: BackupV3): Promise<BackupV3> {
  const tables = ['profiles', ...OWNED] as const;
  if (!tables.some((t) => backup[t].some((r: object) => hasClampedStamp(r)))) return backup;
  const known = new Set<string>();
  for (const p of backup.profiles) {
    const local = await localCopy(repo, p.id);
    if (local) for (const t of tables) for (const r of local[t]) known.add(`${t}:${r.id}`);
  }
  const keep = <T extends { id: string }>(t: (typeof tables)[number], rows: T[]): T[] =>
    rows.filter((r) => !(hasClampedStamp(r) && known.has(`${t}:${r.id}`)));
  return {
    ...backup,
    profiles: keep('profiles', backup.profiles),
    workoutLogs: keep('workoutLogs', backup.workoutLogs),
    programs: keep('programs', backup.programs),
    prRecords: keep('prRecords', backup.prRecords),
    bodyweightEntries: keep('bodyweightEntries', backup.bodyweightEntries),
    exerciseNotes: keep('exerciseNotes', backup.exerciseNotes),
    arsenal: keep('arsenal', backup.arsenal),
    equipment: keep('equipment', backup.equipment),
  };
}
