/**
 * Shared plumbing for the Dexie repository: clock, ids, write transactions,
 * outbox queueing and small validation/list helpers.
 */
import Dexie, { type Table } from 'dexie';
import { RepoError, isRepoError, type ListOptions } from '@/contracts/repo';
import type { SyncAdapter, SyncOperation, SyncOperationType, SyncTable } from '@/contracts/sync';
import type { TytaxDatabase } from '../dexie';

/** Handed to every write; queues outbox rows inside the running transaction. */
export interface WriteScope {
  queue(table: SyncTable, op: SyncOperationType, recordId: string, profileId: string): Promise<void>;
}

export interface RepoContext {
  readonly db: TytaxDatabase;
  readonly sync: SyncAdapter;
  now(): Date;
  newId(): string;
  /** `now()` as an ISO string. */
  stamp(): string;
  /** One rw transaction over every table; notifies the sync adapter after commit when ops were queued. */
  write<T>(fn: (w: WriteScope) => Promise<T>): Promise<T>;
  /** Public `Repository.transaction`: nested repo writes join it; notification waits for the outer commit. */
  transaction<T>(fn: () => Promise<T>): Promise<T>;
}

export interface ContextOptions {
  db: () => TytaxDatabase;
  sync: () => SyncAdapter;
  now: () => Date;
  newId: () => string;
}

export function createContext(opts: ContextOptions): RepoContext {
  let outerDepth = 0;
  let pendingNotify = false;

  const notify = (): void => {
    if (outerDepth > 0) {
      pendingNotify = true;
      return;
    }
    try {
      opts.sync().notifyChanged();
    } catch {
      // The adapter must never break a committed write.
    }
  };

  const ctx: RepoContext = {
    get db() {
      return opts.db();
    },
    get sync() {
      return opts.sync();
    },
    now: () => opts.now(),
    newId: () => opts.newId(),
    stamp: () => opts.now().toISOString(),

    async write<T>(fn: (w: WriteScope) => Promise<T>): Promise<T> {
      const db = opts.db();
      let queued = 0;
      const scope: WriteScope = {
        async queue(table, op, recordId, profileId) {
          if (!opts.sync().enabled) return;
          const row: SyncOperation = {
            id: opts.newId(),
            table,
            op,
            recordId,
            profileId,
            createdAt: opts.now().toISOString(),
            retryCount: 0,
          };
          await db.syncQueue.add(row);
          queued += 1;
        },
      };
      // The scope function must be an `async` function: Dexie only keeps the
      // transaction zone across native awaits for AsyncFunction scopes.
      const result = await wrapStorage(() => db.transaction('rw', db.tables, async () => fn(scope)));
      if (queued > 0) notify();
      return result;
    },

    async transaction<T>(fn: () => Promise<T>): Promise<T> {
      const db = opts.db();
      outerDepth += 1;
      let ok = false;
      try {
        const result = await wrapStorage(() => db.transaction('rw', db.tables, async () => fn()));
        ok = true;
        return result;
      } finally {
        outerDepth -= 1;
        if (outerDepth === 0) {
          const shouldNotify = pendingNotify && ok;
          pendingNotify = false;
          if (shouldNotify) notify();
        }
      }
    },
  };
  return ctx;
}

/** RepoErrors pass through; anything else from IndexedDB becomes STORAGE. */
async function wrapStorage<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (e) {
    if (isRepoError(e)) throw e;
    if (isDexieError(e)) throw new RepoError('STORAGE', e.message, e);
    throw e;
  }
}

function isDexieError(e: unknown): e is Error {
  // IndexedDB failures (quota, constraint, closed database) surface as DexieError subclasses.
  return e instanceof Dexie.DexieError;
}

// ─── Validation ──────────────────────────────────────────────────────────────

const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isCalendarDay(v: unknown): v is string {
  if (typeof v !== 'string') return false;
  const m = DAY_RE.exec(v);
  if (!m) return false;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

export function assertDay(v: unknown, field: string): asserts v is string {
  if (!isCalendarDay(v)) throw new RepoError('VALIDATION', `${field} must be a 'YYYY-MM-DD' date`);
}

export function isIsoTimestamp(v: unknown): v is string {
  return typeof v === 'string' && v.length >= 10 && Number.isFinite(Date.parse(v));
}

export function assertTimestamp(v: unknown, field: string): asserts v is string {
  if (!isIsoTimestamp(v)) throw new RepoError('VALIDATION', `${field} must be an ISO timestamp`);
}

export function assertNonNegative(v: unknown, field: string): asserts v is number {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) {
    throw new RepoError('VALIDATION', `${field} must be a finite number >= 0`);
  }
}

export function assertPositive(v: unknown, field: string): asserts v is number {
  if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0) {
    throw new RepoError('VALIDATION', `${field} must be a finite number > 0`);
  }
}

export function assertNonEmpty(v: unknown, field: string): asserts v is string {
  if (typeof v !== 'string' || v.trim() === '') throw new RepoError('VALIDATION', `${field} must not be empty`);
}

export function notFound(what: string, id: string): RepoError {
  return new RepoError('NOT_FOUND', `${what} ${id} not found`);
}

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
