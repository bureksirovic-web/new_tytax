/**
 * Far-future record stamps in an untrusted backup are clamped to "now".
 *
 * Restore and sync are last-write-wins on `updatedAt`. A backup row stamped
 * e.g. 9999-12-31 would win every later restore and LWW sync forever, so a
 * hostile file could pin an overwritten profile against its owner's genuine
 * backup. Any createdAt / updatedAt / deletedAt later than now plus a small
 * clock skew is rewritten to now, with an INVALID_VALUE warning per field.
 *
 * "Now" moves on every restore, so a clamped row is also remembered
 * (`hasClampedStamp`): the restore service never lets such a row replace a row
 * this device already has, or the same file would win again at each restore.
 */
import type { BackupV3 } from '@/contracts';
import type { ImportWarning } from '../types';
import { OWNED_TABLES } from './schema';

/** Allowed clock skew between the exporting device and this one. */
export const MAX_FUTURE_SKEW_MS = 24 * 60 * 60 * 1000;

const STAMP_FIELDS = ['createdAt', 'updatedAt', 'deletedAt'] as const;

type Stamped = Partial<Record<(typeof STAMP_FIELDS)[number], string>>;

/** Row objects of parsed backups that had at least one stamp clamped. */
const clampedRows = new WeakSet<object>();

/** True when `row` (a row object of a parsed backup) had a far-future stamp clamped to now. */
export function hasClampedStamp(row: object): boolean {
  return clampedRows.has(row);
}

function clampRows(table: string, rows: readonly Stamped[], limitMs: number, now: string, warnings: ImportWarning[]): void {
  rows.forEach((row, i) => {
    for (const field of STAMP_FIELDS) {
      const value = row[field];
      if (typeof value !== 'string' || Date.parse(value) <= limitMs) continue;
      row[field] = now;
      clampedRows.add(row);
      warnings.push({
        code: 'INVALID_VALUE',
        path: `${table}[${i}].${field}`,
        message: `Timestamp ${value} is in the future; clamped to ${now}`,
      });
    }
  });
}

/** Mutates `backup` in place (it is the parser's own copy). */
export function clampFutureStamps(backup: BackupV3, now: Date, warnings: ImportWarning[]): void {
  const limitMs = now.getTime() + MAX_FUTURE_SKEW_MS;
  const stamp = now.toISOString();
  clampRows('profiles', backup.profiles, limitMs, stamp, warnings);
  for (const table of OWNED_TABLES) clampRows(table, backup[table], limitMs, stamp, warnings);
}
