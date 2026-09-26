/**
 * parseBackupV3: untrusted JSON text (or an already-parsed value) -> BackupV3.
 *
 * Pipeline: size cap + depth cap + JSON.parse + prototype-pollution post-walk
 * (shared with the legacy importer, `../safe-json`), then envelope checks
 * (format tag, version), then the zod schema, then cross-record checks.
 *
 * Error mapping (reuses ImportError codes):
 * - TOO_LARGE / INVALID_JSON / UNSAFE_KEYS: from safe-json.
 * - UNRECOGNIZED_FORMAT: not an object, wrong `format` tag, or `version` !== 3.
 * - INVALID_STRUCTURE: schema failure, orphan `profileId`, duplicate id in a table,
 *   or a broken cross-record invariant (see ./invariants).
 *
 * Timestamps come back normalised to UTC `toISOString()` form; derived or pointer
 * fields that disagree with the data are repaired with an INVALID_VALUE warning.
 */
import type { BackupV3 } from '@/contracts';
import { ImportError } from '../errors';
import { createContext, safeParseJson, sanitize } from '../safe-json';
import type { ImportWarning, ParseOptions } from '../types';
import { enforceInvariants } from './invariants';
import { BACKUP_V3_FORMAT, BACKUP_V3_VERSION, backupV3Schema, OWNED_TABLES } from './schema';

export type BackupV3ParseOptions = Pick<ParseOptions, 'maxBytes' | 'maxDepth' | 'unsafeKeys'>;

export interface ParsedBackupV3 {
  backup: BackupV3;
  /** Non-fatal findings, e.g. UNSAFE_KEY_STRIPPED. */
  warnings: ImportWarning[];
}

/** Most schema issues quoted in one INVALID_STRUCTURE message. */
const MAX_REPORTED_ISSUES = 5;

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** zod issue path -> "workoutLogs[0].exercises[1].kg". */
export function formatIssuePath(path: ReadonlyArray<PropertyKey>): string {
  let out = '';
  for (const key of path) {
    if (typeof key === 'number') out += `[${key}]`;
    else out += out ? `.${String(key)}` : String(key);
  }
  return out;
}

function assertEnvelope(value: unknown): void {
  if (!isPlainRecord(value)) {
    throw new ImportError('UNRECOGNIZED_FORMAT', 'Expected a JSON object at the top level');
  }
  if (value.format !== BACKUP_V3_FORMAT) {
    throw new ImportError('UNRECOGNIZED_FORMAT', `Not a TYTAX backup (format tag must be "${BACKUP_V3_FORMAT}")`, 'format');
  }
  if (value.version !== BACKUP_V3_VERSION) {
    throw new ImportError(
      'UNRECOGNIZED_FORMAT',
      `Unsupported backup version ${JSON.stringify(value.version) ?? 'undefined'} (expected ${BACKUP_V3_VERSION})`,
      'version',
    );
  }
}

function validateSchema(value: unknown): BackupV3 {
  const result = backupV3Schema.safeParse(value);
  if (result.success) return result.data;
  const issues = result.error.issues;
  const detail = issues
    .slice(0, MAX_REPORTED_ISSUES)
    .map((i) => `${formatIssuePath(i.path) || '(root)'}: ${i.message}`)
    .join('; ');
  const more = issues.length > MAX_REPORTED_ISSUES ? ` (+${issues.length - MAX_REPORTED_ISSUES} more)` : '';
  throw new ImportError('INVALID_STRUCTURE', `Invalid backup: ${detail}${more}`, formatIssuePath(issues[0].path));
}

function assertUniqueIds(table: string, rows: ReadonlyArray<{ id: string }>): void {
  const seen = new Set<string>();
  rows.forEach((row, i) => {
    if (seen.has(row.id)) {
      throw new ImportError('INVALID_STRUCTURE', `Duplicate id "${row.id}" in ${table}`, `${table}[${i}].id`);
    }
    seen.add(row.id);
  });
}

/** Ids unique per table; every owned record references a profile present in the backup. */
export function validateReferences(backup: BackupV3): void {
  assertUniqueIds('profiles', backup.profiles);
  const profileIds = new Set(backup.profiles.map((p) => p.id));
  for (const table of OWNED_TABLES) {
    const rows: ReadonlyArray<{ id: string; profileId: string }> = backup[table];
    assertUniqueIds(table, rows);
    rows.forEach((row, i) => {
      if (!profileIds.has(row.profileId)) {
        throw new ImportError(
          'INVALID_STRUCTURE',
          `${table}[${i}] references unknown profile "${row.profileId}"`,
          `${table}[${i}].profileId`,
        );
      }
    });
  }
}

/**
 * @param input JSON text, or an already-parsed value (deep-copied and sanitized).
 * @throws ImportError (see module doc for codes).
 */
export function parseBackupV3(input: unknown, opts: BackupV3ParseOptions = {}): ParsedBackupV3 {
  const warnings: ImportWarning[] = [];
  const ctx = createContext(opts, warnings);
  const value = typeof input === 'string' ? safeParseJson(input, ctx) : sanitize(input, ctx);
  assertEnvelope(value);
  const backup = validateSchema(value);
  validateReferences(backup);
  enforceInvariants(backup, warnings);
  return { backup, warnings };
}
