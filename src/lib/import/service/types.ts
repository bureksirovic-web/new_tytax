/** Public types of the import/restore services (see ./index.ts for the API). */
import type { ImportWarning, LegacyFormat } from '../types';
import type { LegacyNameResolver, MapWarning, UnresolvedExercise } from '../map/types';

/** One service warning: parser (`ImportWarning`) or mapper (`MapWarning`), tagged with the user it came from. */
export interface ServiceWarning {
  /** Legacy username; absent for file-level parser warnings. */
  username?: string;
  code: ImportWarning['code'] | MapWarning['code'];
  path: string;
  message: string;
}

export interface LegacyUserPreview {
  username: string;
  logs: number;
  /** Every set in every log (warm-ups and undone sets included). */
  sets: number;
  bodyweight: number;
  programs: number;
  /** Names the resolver could not map; imported as custom exercises, never dropped. At most 200, most frequent first kept (./cap). */
  unresolved: UnresolvedExercise[];
  /** Distinct unresolved names before the cap. */
  unresolvedCount: number;
  /** At most 200 plus one summary per omitted code (./cap). */
  warnings: ServiceWarning[];
}

export interface LegacyImportPreview {
  format: LegacyFormat;
  users: LegacyUserPreview[];
  /** File-level parser warnings (per-user mapper warnings live on each user); capped like the per-user list. */
  warnings: ServiceWarning[];
}

export interface PreviewOptions {
  /** Default: the real catalog (`catalog.loadCatalog()`). */
  resolver?: LegacyNameResolver;
}

export type ImportTarget = { profileId: string } | { createProfileName: string };

export interface ImportLegacyOptions {
  /** Which legacy users to import and where. Users not listed are ignored. */
  users: ReadonlyArray<{ username: string; target: ImportTarget }>;
  /** Default: the real catalog (`catalog.loadCatalog()`), loaded before the transaction starts. */
  resolver?: LegacyNameResolver;
  /** ISO timestamp for createdAt/updatedAt of imported rows. Default: the wall clock. */
  now?: () => string;
}

export interface ImportCounts {
  inserted: number;
  updated: number;
  skipped: number;
}

export interface LegacyUserResult {
  username: string;
  profileId: string;
  createdProfile: boolean;
  /** A re-imported row (same deterministic id, soft-deleted or not) is skipped, never overwritten. */
  logs: ImportCounts;
  bodyweight: ImportCounts;
  programs: ImportCounts;
  /** Recomputed PR records: `updated` includes stale records that were soft-deleted. */
  prRecords: ImportCounts;
  /** True when the profile had no active program and the imported plan became active. */
  activatedProgramId: string | null;
  /** Setting keys applied (only for a newly created profile). */
  settingsApplied: string[];
}

export interface LegacyImportResult {
  perUser: LegacyUserResult[];
  /** Summed over the imported users, sorted by legacyName; at most 200 (the most frequent). */
  unresolved: UnresolvedExercise[];
  /** Distinct unresolved names before the cap. */
  unresolvedCount: number;
  /** At most 200 plus one summary per omitted code (./cap). */
  warnings: ServiceWarning[];
}

export interface RestoreResult {
  inserted: number;
  updated: number;
  /** Rows kept because the local copy was newer (LWW on updatedAt). */
  skipped: number;
  /** Non-fatal parse findings and repairs from parseBackupV3. */
  warnings: ImportWarning[];
  /** Backup profile ids that already existed on this device; their rows were merged (LWW). */
  existingProfileIds: string[];
}

/** Profile-owned backup tables compared per profile by `inspectBackupJson`. */
export type BackupOwnedTable = 'workoutLogs' | 'programs' | 'prRecords' | 'bodyweightEntries' | 'exerciseNotes' | 'arsenal' | 'equipment';

/** One backup profile that already exists (live) on this device. */
export interface BackupProfileConflict {
  profileId: string;
  localName: string;
  backupName: string;
  localUpdatedAt: string;
  backupUpdatedAt: string;
  /** The restore would replace at least one existing local row of this profile (the profile row included; LWW winner that differs). */
  wouldOverwrite: boolean;
  /** The restore would add rows this device does not have to this profile. */
  wouldAdd: boolean;
  /** Live (not soft-deleted) rows per table: on this device vs in the file. */
  rowCountsByTable: Record<BackupOwnedTable, { local: number; incoming: number }>;
}

/** `inspectBackupJson`: what a restore would touch, before it runs. */
export interface BackupInspection {
  profiles: { id: string; name: string; existsLocally: boolean }[];
  /** Records in the file, all tables. */
  rows: number;
  warnings: ImportWarning[];
  /** One entry per backup profile that exists locally (order of the file). */
  conflicts: BackupProfileConflict[];
  /**
   * True when some conflict would overwrite or add rows. restoreBackupJson
   * then refuses (RepoError CONFLICT) unless `confirmOverwrite: true`.
   * Re-restoring a file already applied is a no-op and needs no confirmation.
   */
  requiresConfirmation: boolean;
}
