/**
 * JSON backup/restore over the repository (BackupV3 file format).
 *
 * - exportBackupJson: repo.exportBackup (soft-deleted rows included) ->
 *   serializeBackupV3 (sorted keys: same data, same bytes).
 * - restoreBackupJson: parseBackupV3 (size/depth caps, prototype-pollution
 *   guard, zod schema, references, invariants) -> repo.importBackup (one
 *   transaction, idempotent by id, LWW on updatedAt; see
 *   src/lib/db/repo/transfer.ts). It never changes the active profile.
 */
import { RepoError, type BackupV3, type Repository } from '@/contracts';
import { isDataRow, sameRow, timeOf, type DataRow } from '@/lib/db/repo/tables';
import { backupV3Schema, formatIssuePath, parseBackupV3, serializeBackupV3, validateReferences } from '../backup-v3';
import type { BackupV3ParseOptions } from '../backup-v3';
import { ImportError } from '../errors';
import type { BackupInspection, BackupOwnedTable, BackupProfileConflict, RestoreResult } from './types';

/** restoreBackupJson options: the parser's, plus the hostile-restore guard. */
export type RestoreBackupOptions = BackupV3ParseOptions & {
  /** Required (true) when `inspectBackupJson(..).requiresConfirmation`; otherwise the restore throws RepoError CONFLICT. */
  confirmOverwrite?: boolean;
};

const OWNED: readonly BackupOwnedTable[] = ['workoutLogs', 'programs', 'prRecords', 'bodyweightEntries', 'exerciseNotes', 'arsenal', 'equipment'];

export async function exportBackupJson(repo: Repository, profileId?: string, opts: { pretty?: boolean } = {}): Promise<string> {
  return serializeBackupV3(await repo.exportBackup(profileId), opts);
}

function rowCount(b: BackupV3): number {
  return (
    b.profiles.length +
    b.workoutLogs.length +
    b.programs.length +
    b.prRecords.length +
    b.bodyweightEntries.length +
    b.exerciseNotes.length +
    b.arsenal.length +
    b.equipment.length
  );
}

/**
 * @throws ImportError for a malformed file; RepoError (VALIDATION/CONFLICT) when
 * it clashes with local data; RepoError CONFLICT when the file would overwrite
 * or add to a profile that exists on this device and `confirmOverwrite` is not
 * true (default-safe). Either way nothing is written.
 */
export async function restoreBackupJson(repo: Repository, text: string, opts: RestoreBackupOptions = {}): Promise<RestoreResult> {
  const { confirmOverwrite, ...parseOpts } = opts;
  const { backup, warnings } = parseBackupV3(text, parseOpts);
  const existingProfileIds = await existingIds(repo, backup);
  if (confirmOverwrite !== true) {
    const conflicts = await conflictsOf(repo, backup, existingProfileIds);
    const hit = conflicts.filter(needsConfirmation).map((c) => c.profileId);
    if (hit.length > 0) throw new RepoError('CONFLICT', `Restore would change existing profiles (${hit.join(', ')}); confirm first`);
  }
  const { inserted, updated } = await repo.importBackup(backup);
  return { inserted, updated, skipped: rowCount(backup) - inserted - updated, warnings, existingProfileIds };
}

const needsConfirmation = (c: BackupProfileConflict): boolean => c.wouldOverwrite || c.wouldAdd;

async function existingIds(repo: Repository, backup: BackupV3): Promise<string[]> {
  const ids: string[] = [];
  for (const p of backup.profiles) if ((await repo.profiles.get(p.id)) !== undefined) ids.push(p.id);
  return ids;
}

/**
 * Read-only pre-flight for the restore UI: parses the file (same checks and
 * repairs as restoreBackupJson) and names the profiles it contains, flagging
 * the ones that already exist on this device. A restore merges into those
 * (LWW), so the UI should confirm before rewriting another family member's
 * profile. Writes nothing.
 */
export async function inspectBackupJson(repo: Repository, text: string, opts: BackupV3ParseOptions = {}): Promise<BackupInspection> {
  const { backup, warnings } = parseBackupV3(text, opts);
  const ids = await existingIds(repo, backup);
  const existing = new Set(ids);
  const profiles = backup.profiles.map((p) => ({ id: p.id, name: p.name, existsLocally: existing.has(p.id) }));
  const conflicts = await conflictsOf(repo, backup, ids);
  return { profiles, rows: rowCount(backup), warnings, conflicts, requiresConfirmation: conflicts.some(needsConfirmation) };
}

const live = (rows: readonly DataRow[]): number => rows.filter((r) => !r.deletedAt).length;

/** Would importBackup write `incoming` over `local`? Mirrors the LWW rule of src/lib/db/repo/import-plan.ts. */
function wins(incoming: DataRow, local: DataRow): boolean {
  const localTime = timeOf(local.updatedAt);
  const time = timeOf(incoming.updatedAt);
  if (Number.isFinite(localTime) && time > localTime) return true;
  if (Number.isFinite(localTime) && time !== localTime) return false;
  return !sameRow(incoming, local);
}

const rowWins = (incoming: unknown, local: unknown): boolean => isDataRow(incoming) && isDataRow(local) && wins(incoming, local);

/** Notes/arsenal keep one live row per exercise: a different live id for the same exercise replaces one side. */
function keyedClash(table: BackupOwnedTable, row: DataRow, local: readonly DataRow[]): boolean {
  if ((table !== 'exerciseNotes' && table !== 'arsenal') || row.deletedAt) return false;
  return local.some((l) => !l.deletedAt && l.id !== row.id && l.exerciseId === row.exerciseId);
}

async function conflictsOf(repo: Repository, backup: BackupV3, ids: readonly string[]): Promise<BackupProfileConflict[]> {
  const out: BackupProfileConflict[] = [];
  for (const id of ids) {
    const incomingProfile = backup.profiles.find((p) => p.id === id);
    const local = await repo.exportBackup(id);
    const localProfile = local.profiles[0];
    if (!incomingProfile || !localProfile) continue;
    let wouldOverwrite = rowWins(incomingProfile, localProfile);
    let wouldAdd = false;
    const rowCountsByTable: Partial<TableCounts> = {};
    for (const table of OWNED) {
      const localRows: readonly unknown[] = local[table];
      const fileRows: readonly unknown[] = backup[table];
      const mine = localRows.filter(isDataRow);
      const theirs = fileRows.filter(isDataRow).filter((r) => r.profileId === id);
      rowCountsByTable[table] = { local: live(mine), incoming: live(theirs) };
      const byId = new Map(mine.map((r) => [r.id, r]));
      for (const row of theirs) {
        const prev = byId.get(row.id);
        if (prev) wouldOverwrite ||= wins(row, prev);
        else if (keyedClash(table, row, mine)) wouldOverwrite = true;
        else if (!row.deletedAt) wouldAdd = true;
      }
    }
    out.push({
      profileId: id,
      localName: localProfile.name,
      backupName: incomingProfile.name,
      localUpdatedAt: localProfile.updatedAt,
      backupUpdatedAt: incomingProfile.updatedAt,
      wouldOverwrite,
      wouldAdd,
      rowCountsByTable: rowCountsByTable as TableCounts,
    });
  }
  return out;
}

type TableCounts = BackupProfileConflict['rowCountsByTable'];

/**
 * Schema + reference check of a backup the service built itself, without the
 * repairs parseBackupV3 would apply (a partial backup legitimately names an
 * active program that is not in it).
 * @throws ImportError INVALID_STRUCTURE
 */
export function assertValidBackup(backup: BackupV3): void {
  const result = backupV3Schema.safeParse(backup);
  if (!result.success) {
    const issue = result.error.issues[0];
    const path = formatIssuePath(issue.path);
    throw new ImportError('INVALID_STRUCTURE', `Invalid import record at ${path}: ${issue.message}`, path);
  }
  validateReferences(backup);
}
