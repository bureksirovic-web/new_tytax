/**
 * Per-table row validation against the BackupV3 domain schemas, for callers
 * that store rows verbatim (repo.importBackup, repo.applyRemote) and must not
 * persist a row that later breaks reads (review S3-11). Validation only: the
 * parsed (normalised) value is discarded, the caller keeps its own row.
 */
import { z } from 'zod/v4';
import type { BackupV3 } from '@/contracts';
import { backupV3Schema } from './schema';
import { formatIssuePath } from './parse';

export type BackupTableKey = Exclude<keyof BackupV3, 'format' | 'version' | 'exportedAt'>;

type RowSchema = z.ZodObject<z.ZodRawShape>;

function rowSchema(table: BackupTableKey): RowSchema {
  const field = backupV3Schema.shape[table] as unknown as z.ZodArray<RowSchema>;
  return field.element;
}

/**
 * Drops top-level `null`s where the schema accepts `undefined` (an optional
 * column pulled from SQL as NULL); a nullable field like `activeProgramId` keeps its null.
 */
function withoutOptionalNulls(schema: RowSchema, row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    const field = schema.shape[key];
    if (value === null && field !== undefined && !z.safeParse(field, null).success && z.safeParse(field, undefined).success) continue;
    out[key] = value;
  }
  return out;
}

/** null when the row matches its table's domain shape, else "path: message" of the first issue. */
export function rowProblem(table: BackupTableKey, row: unknown, opts: { nullAsAbsent?: boolean } = {}): string | null {
  const schema = rowSchema(table);
  const input = opts.nullAsAbsent && typeof row === 'object' && row !== null && !Array.isArray(row)
    ? withoutOptionalNulls(schema, row as Record<string, unknown>)
    : row;
  const result = schema.safeParse(input);
  if (result.success) return null;
  const issue = result.error.issues[0];
  return `${formatIssuePath(issue.path) || '(row)'}: ${issue.message}`;
}
