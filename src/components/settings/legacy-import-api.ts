import type { Repository } from '@/contracts/repo';

/**
 * Structural mirror of G2's legacy import service (`@/lib/import`, files
 * `service/index.ts` and `service/types.ts` on branch v2-g2). `@/lib/import`
 * is not in branch v2-g4, so settings cannot import its types; these copies
 * keep only the fields the UI reads. G2's real functions must stay assignable
 * to `LegacyImportApi` (checked by tsc where the adapter wires them, request
 * G4-35). Optional fields cover G2 revisions that do not report them yet.
 */
export interface LegacyServiceWarning {
  /** Legacy username; absent for file-level parser warnings. */
  username?: string;
  code: string;
  path: string;
  message: string;
}

export interface LegacyUnresolvedExercise {
  legacyName: string;
  occurrences: number;
}

export interface LegacyUserPreview {
  username: string;
  logs: number;
  sets: number;
  bodyweight: number;
  programs: number;
  /** Capped list (G2 keeps the most frequent 200). */
  unresolved: LegacyUnresolvedExercise[];
  /** Distinct unresolved names before the cap. */
  unresolvedCount?: number;
  warnings: LegacyServiceWarning[];
}

export interface LegacyImportPreview {
  format: 'app-backup' | 'localstorage-dump';
  users: LegacyUserPreview[];
  warnings: LegacyServiceWarning[];
}

export type LegacyImportTarget = { profileId: string } | { createProfileName: string };

export interface LegacyImportOptions {
  users: ReadonlyArray<{ username: string; target: LegacyImportTarget }>;
}

export interface LegacyImportCounts {
  inserted: number;
  updated: number;
  skipped: number;
}

export interface LegacyUserResult {
  username: string;
  profileId: string;
  createdProfile: boolean;
  logs: LegacyImportCounts;
  bodyweight: LegacyImportCounts;
  programs: LegacyImportCounts;
  activatedProgramId: string | null;
}

export interface LegacyImportResult {
  perUser: LegacyUserResult[];
  unresolved: LegacyUnresolvedExercise[];
  unresolvedCount?: number;
  warnings: LegacyServiceWarning[];
}

/** `preview` = G2 `previewLegacyImport`, `run` = G2 `importLegacy`. Both take the file's JSON text. */
export interface LegacyImportApi {
  preview(input: unknown): Promise<LegacyImportPreview>;
  run(repo: Repository, input: unknown, opts: LegacyImportOptions): Promise<LegacyImportResult>;
}

/** Same cap as G2's parser (`DEFAULT_MAX_BYTES`, 20 MiB): larger files are refused before reading. */
export const LEGACY_MAX_BYTES = 20 * 1024 * 1024;

/** Error code (G2 `ImportError.code` or `RepoError.code`) → settings i18n key. */
const ERROR_KEY = {
  TOO_LARGE: 'set_import_error_too_large',
  INVALID_JSON: 'set_import_error_invalid_json',
  UNSAFE_KEYS: 'set_import_error_unsafe',
  UNRECOGNIZED_FORMAT: 'set_legacy_error_unrecognized',
  INVALID_STRUCTURE: 'set_legacy_error_structure',
  VALIDATION: 'set_legacy_error_validation',
  NOT_FOUND: 'set_legacy_error_not_found',
  CONFLICT: 'set_legacy_error_conflict',
} as const;

export type LegacyErrorKey = (typeof ERROR_KEY)[keyof typeof ERROR_KEY] | 'set_action_failed';

export function legacyErrorKey(error: unknown): LegacyErrorKey {
  const code = typeof error === 'object' && error !== null ? (error as { code?: unknown }).code : undefined;
  return typeof code === 'string' && Object.prototype.hasOwnProperty.call(ERROR_KEY, code)
    ? ERROR_KEY[code as keyof typeof ERROR_KEY]
    : 'set_action_failed';
}
