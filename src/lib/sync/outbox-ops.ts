/**
 * Outbox bookkeeping for the push: which ops to send (dead letters and ops of
 * other accounts' profiles never block the queue) and how to settle them.
 */
import type { Repository } from '@/contracts/repo';
import type { SyncOperation, SyncOutbox, SyncTable } from '@/contracts/sync';
import { PERMANENT_PREFIX, isDeadLetter, type RemoteError } from './errors';
import type { SyncLogger } from './log';
import type { RemoteRow } from './mapper';

export const PEEK_LIMIT = 200;
const MAX_PEEK = 6_400;

export const keyOf = (table: string, id: string): string => `${table}:${id}`;

/** One record to push (all its queued ops collapse into one upsert of its current state). */
export interface PushEntry {
  table: SyncTable;
  recordId: string;
  profileId: string;
  opIds: string[];
  lastOp?: SyncOperation;
  row?: RemoteRow;
  skip?: string;
  failed?: string;
  retryCode?: string;
  /** Live local record with a queued op: a server tombstone is cleared (undelete_row). */
  restore?: boolean;
  need: number;
  ok: number;
}

export interface PushOutcome {
  pushed: number;
  failed: number;
  /** Retryable or auth failure that stopped the push; the run stops too. */
  abort?: RemoteError;
  /** Code of the last permanent failure, if any. */
  permanentCode?: string;
  /** Ops acked or dead-lettered by this push (progress, for the drain loop). */
  settled: number;
  /** The peek window was full: more ops may be waiting. */
  more: boolean;
  /** Ops left queued because their profile belongs to another account. */
  deferred: number;
}

/** Oldest-first live ops; widens the peek window past dead letters and deferred ops so they never block the queue. */
export async function collectOps(
  outbox: SyncOutbox,
  pushable: (op: SyncOperation) => boolean,
): Promise<{ live: SyncOperation[]; dead: SyncOperation[]; deferred: number }> {
  for (let limit = PEEK_LIMIT; ; limit *= 2) {
    const ops = await outbox.peek(limit);
    const dead = ops.filter((o) => isDeadLetter(o.lastError));
    const live = ops.filter((o) => !isDeadLetter(o.lastError) && pushable(o));
    if (live.length >= PEEK_LIMIT || ops.length < limit || limit >= MAX_PEEK) {
      return { live: live.slice(0, PEEK_LIMIT), dead, deferred: ops.length - dead.length - live.length };
    }
  }
}

/**
 * `table:id` of every record with a queued op that can still be pushed (dead
 * letters excluded: their change was rejected, so the server copy may win).
 * Reads the whole outbox, not one peek window; call it inside the
 * transaction that applies pulled rows so no edit slips in between.
 */
export async function pendingRecordKeys(outbox: SyncOutbox): Promise<ReadonlySet<string>> {
  const count = await outbox.count();
  const ops = count > 0 ? await outbox.peek(count) : [];
  return new Set(ops.filter((o) => !isDeadLetter(o.lastError)).map((o) => keyOf(o.table, o.recordId)));
}

/** Acks settled ops (pushed or skipped, plus dead letters of the same record); fails the rest. */
export async function settle(
  repo: Repository,
  log: SyncLogger,
  entries: Iterable<PushEntry>,
  dead: readonly SyncOperation[],
  abort?: RemoteError,
): Promise<Omit<PushOutcome, 'more' | 'deferred'>> {
  const deadByKey = new Map<string, string[]>();
  for (const op of dead) deadByKey.set(keyOf(op.table, op.recordId), [...(deadByKey.get(keyOf(op.table, op.recordId)) ?? []), op.id]);
  const ack: string[] = [];
  const counts = new Map<string, number>();
  const bump = (k: string) => counts.set(k, (counts.get(k) ?? 0) + 1);
  let pushed = 0;
  let failed = 0;
  let permanentCode: string | undefined;
  let failedOps = 0;
  for (const e of entries) {
    const settled = [...e.opIds, ...(deadByKey.get(keyOf(e.table, e.recordId)) ?? [])];
    if (e.skip) {
      ack.push(...settled);
      bump(`skip|${e.table}|${e.skip}`);
    } else if (e.failed) {
      failed += 1;
      permanentCode = e.failed;
      for (const id of e.opIds) await repo.outbox.fail(id, PERMANENT_PREFIX + e.failed);
      failedOps += e.opIds.length;
      bump(`fail|${e.table}|${e.failed}`);
    } else if (e.retryCode) {
      for (const id of e.opIds) await repo.outbox.fail(id, e.retryCode);
    } else if (e.need > 0 && e.ok === e.need) {
      pushed += 1;
      ack.push(...settled);
    }
  }
  if (ack.length > 0) await repo.outbox.ack(ack);
  for (const [k, count] of counts) {
    const [event, table, code] = k.split('|');
    log({ event: event as 'skip' | 'fail', table, code, count });
  }
  return { pushed, failed, abort, permanentCode, settled: ack.length + failedOps };
}
