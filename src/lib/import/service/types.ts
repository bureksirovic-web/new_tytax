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
  /** Names the resolver could not map; imported as custom exercises, never dropped. */
  unresolved: UnresolvedExercise[];
  warnings: ServiceWarning[];
}

export interface LegacyImportPreview {
  format: LegacyFormat;
  users: LegacyUserPreview[];
  /** File-level parser warnings (per-user mapper warnings live on each user). */
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
  /** Summed over the imported users, sorted by legacyName. */
  unresolved: UnresolvedExercise[];
  warnings: ServiceWarning[];
}

export interface RestoreResult {
  inserted: number;
  updated: number;
  /** Rows kept because the local copy was newer (LWW on updatedAt). */
  skipped: number;
  /** Non-fatal parse findings and repairs from parseBackupV3. */
  warnings: ImportWarning[];
}
