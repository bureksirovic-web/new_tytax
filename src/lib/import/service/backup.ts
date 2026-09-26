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
import type { BackupV3, Repository } from '@/contracts';
import { backupV3Schema, formatIssuePath, parseBackupV3, serializeBackupV3, validateReferences } from '../backup-v3';
import type { BackupV3ParseOptions } from '../backup-v3';
import { ImportError } from '../errors';
import type { RestoreResult } from './types';

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
 * it clashes with local data. Either way nothing is written.
 */
export async function restoreBackupJson(repo: Repository, text: string, opts: BackupV3ParseOptions = {}): Promise<RestoreResult> {
  const { backup, warnings } = parseBackupV3(text, opts);
  const { inserted, updated } = await repo.importBackup(backup);
  return { inserted, updated, skipped: rowCount(backup) - inserted - updated, warnings };
}

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
