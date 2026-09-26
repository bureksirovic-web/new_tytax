import type { Repository } from '@/contracts/repo';
import { parseBackupText } from './backup-io';

/**
 * JSON backup/restore for the settings UI. G2's service (`@/lib/import/service`:
 * `exportBackupJson`, `inspectBackupJson`, `restoreBackupJson`) is not in
 * branch v2-g4, and a static import of a missing module breaks the build, so
 * the app uses the local implementation below until the one-line switch in
 * `loadBackupService` (request docs/v2/requests/G4-W2-06-backup-service-switch.md).
 */
export interface InspectedProfile {
  id: string;
  name: string;
  /** A profile with this id is already on this device (soft-deleted included): a restore merges into it. */
  existsLocally: boolean;
}

export interface BackupService {
  exportJson(repo: Repository, profileId?: string): Promise<string>;
  /** Read-only pre-flight; throws a coded error for a bad file. */
  inspect(repo: Repository, text: string): Promise<{ profiles: InspectedProfile[] }>;
  /**
   * `confirmOverwrite`: the user acknowledged merging into profiles the
   * inspection found on this device. G2's service refuses (RepoError CONFLICT)
   * to change an existing profile without it; the local service has no such guard.
   */
  restore(repo: Repository, text: string, opts?: { confirmOverwrite?: boolean }): Promise<{ inserted: number; updated: number }>;
}

/** Thrown by the local service; `code` matches G2's `ImportError.code`. */
export class BackupFileError extends Error {
  constructor(readonly code: 'TOO_LARGE' | 'INVALID_JSON' | 'UNSAFE_KEYS' | 'UNRECOGNIZED_FORMAT' | 'INVALID_STRUCTURE' | 'INVALID_LOGS' | 'INVALID_SETTINGS') {
    super(`backup file rejected: ${code}`);
    this.name = 'BackupFileError';
  }
}

const PROBLEM_CODE = {
  too_large: 'TOO_LARGE',
  invalid_json: 'INVALID_JSON',
  unsafe: 'UNSAFE_KEYS',
  unrecognized: 'UNRECOGNIZED_FORMAT',
  structure: 'INVALID_STRUCTURE',
  bad_logs: 'INVALID_LOGS',
  bad_settings: 'INVALID_SETTINGS',
} as const;

function parseOrThrow(text: string) {
  const parsed = parseBackupText(text);
  if (!parsed.ok) throw new BackupFileError(PROBLEM_CODE[parsed.problem]);
  return parsed.backup;
}

/** The v2-g4 implementation over the repository contract; same semantics as G2's service. */
export const localBackupService: BackupService = {
  async exportJson(repo, profileId) {
    return JSON.stringify(await repo.exportBackup(profileId), null, 2);
  },
  async inspect(repo, text) {
    const backup = parseOrThrow(text);
    const local = new Set((await repo.profiles.list({ includeDeleted: true })).map((p) => p.id));
    return { profiles: backup.profiles.map((p) => ({ id: p.id, name: p.name, existsLocally: local.has(p.id) })) };
  },
  async restore(repo, text) {
    return repo.importBackup(parseOrThrow(text));
  },
};

type AnyFn = (...args: unknown[]) => Promise<unknown>;

/** G2's service module as a `BackupService`, or null when one of its three functions is missing. */
export function fromG2Service(mod: Record<string, unknown>): BackupService | null {
  const { exportBackupJson, inspectBackupJson, restoreBackupJson } = mod;
  if (typeof exportBackupJson !== 'function' || typeof inspectBackupJson !== 'function' || typeof restoreBackupJson !== 'function') {
    return null;
  }
  const [exp, insp, rest] = [exportBackupJson, inspectBackupJson, restoreBackupJson] as AnyFn[];
  return {
    exportJson: (repo, profileId) => exp(repo, profileId, { pretty: true }) as Promise<string>,
    inspect: (repo, text) => insp(repo, text) as Promise<{ profiles: InspectedProfile[] }>,
    restore: (repo, text, opts) => rest(repo, text, { confirmOverwrite: opts?.confirmOverwrite === true }) as Promise<{ inserted: number; updated: number }>,
  };
}

export async function loadBackupService(): Promise<BackupService> {
  // Integration switch (G4-W2-06): replace the next line with
  // return fromG2Service((await import('@/lib/import/service')) as unknown as Record<string, unknown>) ?? localBackupService;
  return localBackupService;
}

/** Error code (G2 `ImportError.code`, `RepoError.code`, `BackupFileError.code`) → settings i18n key. */
const ERROR_KEY = {
  TOO_LARGE: 'set_import_error_too_large',
  INVALID_JSON: 'set_import_error_invalid_json',
  UNSAFE_KEYS: 'set_import_error_unsafe',
  UNRECOGNIZED_FORMAT: 'set_import_error_unrecognized',
  INVALID_STRUCTURE: 'set_import_error_structure',
  INVALID_LOGS: 'set_import_error_logs',
  INVALID_SETTINGS: 'set_import_error_settings',
  VALIDATION: 'set_restore_error_validation',
  NOT_FOUND: 'set_restore_error_not_found',
  CONFLICT: 'set_restore_error_conflict',
  STORAGE: 'set_restore_error_storage',
} as const;

export type BackupErrorKey = (typeof ERROR_KEY)[keyof typeof ERROR_KEY] | 'set_action_failed';

/** Never the raw message: an unknown error becomes the generic "something went wrong". */
export function backupErrorKey(error: unknown): BackupErrorKey {
  const code = typeof error === 'object' && error !== null ? (error as { code?: unknown }).code : undefined;
  return typeof code === 'string' && Object.prototype.hasOwnProperty.call(ERROR_KEY, code)
    ? ERROR_KEY[code as keyof typeof ERROR_KEY]
    : 'set_action_failed';
}
