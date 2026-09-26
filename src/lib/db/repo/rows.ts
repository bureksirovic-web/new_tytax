/** Pure helpers over stored rows: soft-delete filtering, sorting, paging, patch hygiene. */
import type { Table } from 'dexie';
import type { ListOptions } from '@/contracts/repo';

// ─── Records and lists ───────────────────────────────────────────────────────

export interface SoftDeletable {
  deletedAt?: string;
}

export function isLive(row: SoftDeletable): boolean {
  return !row.deletedAt;
}

export function visible<T extends SoftDeletable>(rows: T[], includeDeleted?: boolean): T[] {
  return includeDeleted ? rows : rows.filter(isLive);
}

export function paginate<T>(rows: T[], opts?: ListOptions): T[] {
  const offset = Math.max(0, Math.floor(opts?.offset ?? 0));
  const limit = opts?.limit;
  if (limit === undefined) return offset ? rows.slice(offset) : rows;
  return rows.slice(offset, offset + Math.max(0, Math.floor(limit)));
}

/** Descending string compare (ISO timestamps and 'YYYY-MM-DD' sort lexically). */
export function desc(a: string | undefined, b: string | undefined): number {
  const x = a ?? '';
  const y = b ?? '';
  return x < y ? 1 : x > y ? -1 : 0;
}

export function asc(a: string | undefined, b: string | undefined): number {
  return -desc(a, b);
}

/** Drops keys whose value is `undefined` (top level only). */
export function compact<T extends object>(obj: T): T {
  const out = { ...obj };
  for (const key of Object.keys(out) as Array<keyof T>) {
    if (out[key] === undefined) delete out[key];
  }
  return out;
}

/** Copy without `deletedAt`. */
export function undeleted<T extends SoftDeletable>(row: T): T {
  const out = { ...row };
  delete out.deletedAt;
  return out;
}

/** Rows of one profile in a table indexed by `profileId`. */
export function byProfile<T>(table: Table<T, string>, profileId: string): Promise<T[]> {
  return table.where('profileId').equals(profileId).toArray();
}

/** Removes keys the caller may never patch. */
export function stripKeys<T extends object>(patch: T, keys: readonly string[]): T {
  const out = { ...patch };
  for (const key of keys) delete (out as Record<string, unknown>)[key];
  return out;
}
