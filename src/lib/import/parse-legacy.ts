/**
 * Entry point: legacy tytax-autonomous backup -> LegacyImportBundle.
 * Parsing and validation only; deterministic (no ids from randomness or clocks):
 * the same input always yields a deep-equal bundle.
 */
import { ImportError } from './errors';
import { parseAppBackup } from './parse-app-backup';
import { parseDump } from './parse-dump';
import { createContext, safeParseJson, sanitize } from './safe-json';
import type { ImportWarning, LegacyImportBundle, ParseOptions } from './types';
import { DEFAULT_USERNAME } from './types';

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export type DetectedFormat = LegacyImportBundle['format'];

/** Detects the format of an already-sanitized top-level value, or throws UNRECOGNIZED_FORMAT. */
export function detectFormat(value: unknown): { format: DetectedFormat; obj: Record<string, unknown> } {
  if (!isPlainRecord(value)) {
    throw new ImportError('UNRECOGNIZED_FORMAT', 'Expected a JSON object at the top level');
  }
  const keys = Object.keys(value);
  if (keys.some((k) => k.startsWith('tytax_'))) return { format: 'localstorage-dump', obj: value };
  if (keys.includes('logs') || keys.includes('sessionOrder')) return { format: 'app-backup', obj: value };
  throw new ImportError('UNRECOGNIZED_FORMAT', 'Neither a TYTAX backup nor a TYTAX localStorage dump');
}

/**
 * @param input JSON text of the file, or an already-parsed value (it is deep-copied and sanitized).
 * @throws ImportError for top-level problems (size, JSON, unsafe keys in 'throw' mode, format, structure).
 */
export function parseLegacyBackup(input: unknown, opts: ParseOptions = {}): LegacyImportBundle {
  const warnings: ImportWarning[] = [];
  const ctx = createContext(opts, warnings);
  const value = typeof input === 'string' ? safeParseJson(input, ctx) : sanitize(input, ctx);
  const { format, obj } = detectFormat(value);
  if (format === 'app-backup') {
    const user = parseAppBackup(obj, opts.backupUsername ?? DEFAULT_USERNAME, warnings);
    return { format, users: [user], shared: { customProtocols: [], settings: {} }, warnings };
  }
  const { users, shared } = parseDump(obj, ctx);
  return { format, users, shared, warnings };
}
