/**
 * Shared plumbing for the Dexie repository: clock, ids, write transactions,
 * outbox queueing. Re-exports the validation and row helpers.
 */
import type { SyncAdapter, SyncOperation, SyncOperationType, SyncTable } from '@/contracts/sync';
import Dexie, { type Transaction } from 'dexie';
import type { TytaxDatabase } from '../dexie';
import { wrapStorage } from './errors';

/** One outbox entry for `WriteScope.queueMany`. */
export interface QueuedOp {
  table: SyncTable;
  op: SyncOperationType;
  recordId: string;
  profileId: string;
}

/** Handed to every write; queues outbox rows inside the running transaction. */
export interface WriteScope {
  queue(table: SyncTable, op: SyncOperationType, recordId: string, profileId: string): Promise<void>;
  /**
   * Queues many ops with one IndexedDB request. Use it instead of awaiting
   * `queue` in a loop with no other IndexedDB work between iterations:
   * with sync off `queue` may make no request, and Dexie drops the transaction
   * zone after 100 consecutive non-IndexedDB awaits (ZONE_ECHO_LIMIT), so
   * IndexedDB auto-commits mid-write (PrematureCommitError, no rollback).
   */
  queueMany(ops: readonly QueuedOp[]): Promise<void>;
}

export interface RepoContext {
  readonly db: TytaxDatabase;
  readonly sync: SyncAdapter;
  now(): Date;
  newId(): string;
  /** `now()` as an ISO string. */
  stamp(): string;
  /**
   * One rw transaction over every table; notifies the sync adapter after
   * commit when ops were queued. Inside `transaction()` (or another write) it
   * joins the caller's transaction and the notification waits for that commit.
   */
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

/** Notification state of one top-level rw transaction; joined writes share it. */
interface Outer {
  pending: boolean;
}

/**
 * Outbox row id that sorts in insertion order. IndexedDB orders equal
 * `createdAt` index keys by primary key, and the clock has millisecond
 * precision, so a random id would let ops of one millisecond come back from
 * `outbox.peek` in random order (a pr_records op before its workout_logs op).
 * The counter is seeded from the wall clock in microseconds, so it keeps
 * rising across reloads; the random suffix keeps ids unique across tabs.
 */
let opSeq = 0;
function nextOpId(random: string): string {
  opSeq = Math.max(opSeq + 1, Date.now() * 1000);
  return `${String(opSeq).padStart(17, '0')}-${random}`;
}

export function createContext(opts: ContextOptions): RepoContext {
  /** Top-level transactions this context opened (keyed by Dexie's transaction object). */
  const outers = new WeakMap<Transaction, Outer>();

  /**
   * The top-level transaction the caller is running inside, if any. Decided
   * from Dexie's zone, never from a global counter: a write that merely runs
   * concurrently with an unrelated `transaction()` is top-level (S3-13).
   */
  const joinedOuter = (): Outer | undefined => {
    for (let tx: Transaction | undefined = Dexie.currentTransaction ?? undefined; tx; tx = tx.parent) {
      const outer = outers.get(tx);
      if (outer) return outer;
    }
    return undefined;
  };

  const notify = (): void => {
    try {
      opts.sync().notifyChanged();
    } catch {
      // The adapter must never break a committed write.
    }
  };

  /** One rw transaction over every table; nested calls join the caller's and notify only after its commit. */
  async function runRw<T>(fn: (outer: Outer) => Promise<T>): Promise<T> {
    const db = opts.db();
    const joined = joinedOuter();
    // The scope functions must be `async` functions: Dexie only keeps the
    // transaction zone across native awaits for AsyncFunction scopes.
    if (joined) return wrapStorage(() => db.transaction('rw', db.tables, async () => fn(joined)));
    const own: Outer = { pending: false };
    const result = await wrapStorage(() =>
      db.transaction('rw', db.tables, async () => {
        const tx = Dexie.currentTransaction;
        if (tx) outers.set(tx, own);
        return fn(own);
      }),
    );
    if (own.pending) notify();
    return result;
  }

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

    write<T>(fn: (w: WriteScope) => Promise<T>): Promise<T> {
      return runRw(async (outer) => {
        const db = opts.db();
        const toRow = (q: QueuedOp, createdAt: string): SyncOperation => ({ id: nextOpId(opts.newId()), ...q, createdAt, retryCount: 0 });
        // With sync off, ops are still queued for a profile an account has
        // claimed (the device synced before): otherwise an edit made while the
        // flag is off has no op, and the first pull after sync is back makes the
        // server copy win over it. Profiles never synced queue nothing.
        // A known answer adds no await (see `queueMany` on ZONE_ECHO_LIMIT).
        const claimed = new Map<string, boolean>();
        const learn = async (profileIds: readonly string[]): Promise<void> => {
          const unknown = [...new Set(profileIds)].filter((id) => !claimed.has(id));
          if (unknown.length === 0) return;
          const rows = await db.profiles.bulkGet(unknown);
          unknown.forEach((id, i) => claimed.set(id, typeof rows[i]?.accountId === 'string'));
        };
        const scope: WriteScope = {
          async queue(table, op, recordId, profileId) {
            if (!opts.sync().enabled) {
              if (!claimed.has(profileId)) await learn([profileId]);
              if (claimed.get(profileId) !== true) return;
            }
            await db.syncQueue.add(toRow({ table, op, recordId, profileId }, opts.now().toISOString()));
            outer.pending = true;
          },
          async queueMany(ops) {
            if (ops.length === 0) return;
            let kept = ops;
            if (!opts.sync().enabled) {
              await learn(ops.map((q) => q.profileId));
              kept = ops.filter((q) => claimed.get(q.profileId) === true);
              if (kept.length === 0) return;
            }
            const createdAt = opts.now().toISOString();
            // Ids are generated in array order, so bulkAdd keeps it too.
            await db.syncQueue.bulkAdd(kept.map((q) => toRow(q, createdAt)));
            outer.pending = true;
          },
        };
        return fn(scope);
      });
    },

    transaction<T>(fn: () => Promise<T>): Promise<T> {
      return runRw(async () => fn());
    },
  };
  return ctx;
}

export * from './validate';
export * from './rows';
