/**
 * Shared plumbing for the Dexie repository: clock, ids, write transactions,
 * outbox queueing. Re-exports the validation and row helpers.
 */
import type { SyncAdapter, SyncOperation, SyncOperationType, SyncTable } from '@/contracts/sync';
import type { TytaxDatabase } from '../dexie';
import { wrapStorage } from './errors';

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

export * from './validate';
export * from './rows';
