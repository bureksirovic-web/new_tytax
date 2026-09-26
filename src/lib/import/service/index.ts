/**
 * Import/restore services for the settings UI (G4). Small API:
 *
 * - previewLegacyImport(input, { resolver? }) -> Promise<LegacyImportPreview>
 *   Dry run: per legacy user the counts of logs, sets, bodyweight, programs,
 *   the unresolved exercise names and warnings. No database access. Async
 *   because the default resolver lazily loads the real catalog.
 *
 * - importLegacy(repo, input, { users: [{ username, target: { profileId } |
 *   { createProfileName } }], resolver?, now? }) -> Promise<LegacyImportResult>
 *   One repo.transaction for the whole file; idempotent re-import into the
 *   same profile; any failure leaves the database unchanged. Decisions in
 *   ./legacy.ts (rows, settings, active program) and ./prs.ts (PR recompute).
 *
 * - exportBackupJson(repo, profileId?, { pretty? }) -> Promise<string>
 * - restoreBackupJson(repo, text) -> Promise<{ inserted, updated, skipped, warnings, existingProfileIds }>
 * - inspectBackupJson(repo, text): read-only pre-flight naming the profiles a restore would merge into
 *   BackupV3 JSON; restore is one transaction, idempotent by id, last-write-
 *   wins on updatedAt, never switches the active profile.
 *
 * Errors: ImportError (file problems, invalid records) and RepoError
 * (VALIDATION, NOT_FOUND, CONFLICT). Messages are for logs; the UI maps codes.
 */
export { previewLegacyImport } from './preview';
export { importLegacy } from './legacy';
export { exportBackupJson, inspectBackupJson, restoreBackupJson } from './backup';
export type {
  BackupInspection,
  ImportCounts,
  ImportLegacyOptions,
  ImportTarget,
  LegacyImportPreview,
  LegacyImportResult,
  LegacyUserPreview,
  LegacyUserResult,
  PreviewOptions,
  RestoreResult,
  ServiceWarning,
} from './types';
