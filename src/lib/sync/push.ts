/**
 * Push: outbox (+ the first-run snapshot) → current local state → wire rows
 * → chunked upserts in parent-first order → undelete where needed → ack / fail.
 */
import type { Profile } from '@/contracts/domain';
import { isRepoError, type Repository } from '@/contracts/repo';
import type { SyncOperation, SyncTable } from '@/contracts/sync';
import { BACKUP_KEY } from './backup-keys';
import { PUSH_ORDER, remoteTableOf } from './columns';
import type { RemoteError } from './errors';
import type { SyncLogger } from './log';
import { SyncMapError, toRemote, type LocalRecord, type RemoteRow } from './mapper';
import { PEEK_LIMIT, collectOps, keyOf, settle, type PushEntry as Entry, type PushOutcome } from './outbox-ops';
import type { RemoteStore } from './remote';

export { collectOps, PEEK_LIMIT, type PushOutcome } from './outbox-ops';
export { BACKUP_KEY } from './backup-keys';

export const CHUNK_SIZE = 100;

/** First-push snapshot: every local record of the account's profiles except those the server already has. */
export interface SnapshotScope {
  /** `table:id` of every row the server returned in the full pull before this push. */
  known: ReadonlySet<string>;
}

export interface PushDeps {
  repo: Repository;
  remote: RemoteStore;
  log: SyncLogger;
}

/** Steps in parent-first order. Profiles go twice: without a set `active_program_id` first (its program may not exist yet), with it after programs. */
const STEPS: ReadonlyArray<{ table: SyncTable; select: (row: RemoteRow) => RemoteRow | null }> = [
  { table: 'profiles', select: (r) => (r.active_program_id == null ? r : withoutActive(r)) },
  { table: 'programs', select: (r) => r },
  { table: 'profiles', select: (r) => (r.active_program_id != null ? r : null) },
  ...PUSH_ORDER.filter((t) => t !== 'profiles' && t !== 'programs').map((table) => ({ table, select: (r: RemoteRow) => r })),
];

function withoutActive(row: RemoteRow): RemoteRow {
  const copy = { ...row };
  delete copy.active_program_id;
  return copy;
}

/**
 * `sent` (shared by the push rounds of one run): `table:id` → the wire row
 * already upserted in this run. A later round acks an op whose record still
 * maps to exactly that row instead of sending it again (the first-run
 * snapshot pushes records whose ops sit beyond the first peek window).
 */
export async function pushRun(
  deps: PushDeps,
  accountId: string,
  snapshot: SnapshotScope | null = null,
  sent: Map<string, string> = new Map(),
): Promise<PushOutcome> {
  const { repo, remote, log } = deps;
  const profiles = new Map<string, Profile>((await repo.profiles.list({ includeDeleted: true })).map((p) => [p.id, p]));
  const foreign = (op: SyncOperation): boolean => {
    const owner = profiles.get(op.profileId)?.accountId;
    return owner !== undefined && owner !== accountId;
  };
  const { live, dead, deferred } = await collectOps(repo.outbox, (op) => !foreign(op));
  if (deferred > 0) log({ event: 'defer', code: 'other_account', count: deferred });

  const entries = new Map<string, Entry>();
  const entryFor = (table: SyncTable, recordId: string, profileId: string): Entry => {
    const key = keyOf(table, recordId);
    let e = entries.get(key);
    if (!e) entries.set(key, (e = { table, recordId, profileId, opIds: [], need: 0, ok: 0 }));
    return e;
  };
  for (const op of live) {
    const e = entryFor(op.table, op.recordId, op.profileId);
    e.opIds.push(op.id);
    if (!e.lastOp || op.createdAt >= e.lastOp.createdAt) e.lastOp = op;
  }

  // One exportBackup per affected profile per run, indexed table → id → record.
  const backups = new Map<string, Map<string, LocalRecord>>();
  const localState = async (profileId: string): Promise<Map<string, LocalRecord>> => {
    let index = backups.get(profileId);
    if (!index) {
      index = new Map();
      // NOT_FOUND: the profile was wiped locally; any other failure aborts the run (retried later).
      const backup = await repo.exportBackup(profileId).catch((e: unknown) => {
        if (isRepoError(e, 'NOT_FOUND')) return null;
        throw e;
      });
      for (const table of PUSH_ORDER) {
        for (const rec of (backup?.[BACKUP_KEY[table]] ?? []) as unknown as LocalRecord[]) index.set(keyOf(table, String(rec.id)), rec);
      }
      backups.set(profileId, index);
    }
    return index;
  };
  if (snapshot) {
    for (const p of profiles.values()) {
      if (p.accountId !== accountId) continue;
      for (const key of (await localState(p.id)).keys()) {
        // The server copy won the pull that preceded this push; re-sending a
        // stale local copy would overwrite a newer edit from another device.
        if (snapshot.known.has(key)) continue;
        const [table, id] = key.split(':') as [SyncTable, string];
        entryFor(table, id, p.id);
      }
    }
  }

  for (const e of entries.values()) {
    const profile = profiles.get(e.profileId);
    if (!profile) e.skip = 'missing_profile';
    else if (profile.accountId === undefined) {
      if (profile.deletedAt) e.skip = 'unclaimed';
      else continue; // Not claimed yet: stays queued for the next run.
    }
    if (e.skip) continue;
    let rec = (await localState(e.profileId)).get(keyOf(e.table, e.recordId));
    if (!rec) {
      e.skip = 'missing_local';
      continue;
    }
    if (e.lastOp?.op === 'delete' && !rec.deletedAt) rec = { ...rec, deletedAt: e.lastOp.createdAt };
    // A live record with a queued op: if the server still holds a tombstone
    // (undo delete, re-add), the upsert keeps it; `send` then calls undelete_row.
    e.restore = !rec.deletedAt && e.opIds.length > 0;
    try {
      e.row = toRemote(e.table, rec, accountId);
    } catch (err) {
      if (!(err instanceof SyncMapError)) throw err;
      e.failed = err.code;
    }
    if (e.row && sent.get(keyOf(e.table, e.recordId)) === JSON.stringify(e.row)) e.skip = 'already_sent';
  }

  for (const step of STEPS) for (const e of entries.values()) if (e.table === step.table && e.row && !e.failed && step.select(e.row)) e.need += 1;

  let abort: RemoteError | undefined;
  /** Sticky tombstone met by a live local record: clear it (LWW by arrival applies to deletes too). */
  const restore = async (table: SyncTable, e: Entry): Promise<RemoteError | undefined> => {
    const res = await remote.undelete(remoteTableOf(table), e.recordId);
    if (res.ok) {
      e.ok += 1;
      log({ event: 'undelete', table, count: 1 });
      return undefined;
    }
    if (res.error.retryable || res.error.authRequired) {
      e.retryCode = res.error.code;
      return res.error;
    }
    e.failed = res.error.code;
    return undefined;
  };
  const send = async (table: SyncTable, chunk: Entry[], rows: RemoteRow[]): Promise<RemoteError | undefined> => {
    const res = await remote.upsert(remoteTableOf(table), rows);
    if (res.ok) {
      const tombstoned = new Set(res.rows.filter((r) => r.deleted_at != null).map((r) => String(r.id)));
      for (const e of chunk) {
        if (e.restore && tombstoned.has(e.recordId)) {
          const stop = await restore(table, e);
          if (stop) return stop;
        } else {
          e.ok += 1;
        }
      }
      return undefined;
    }
    if (res.error.retryable || res.error.authRequired) {
      chunk.forEach((e) => (e.retryCode = res.error.code));
      return res.error;
    }
    if (chunk.length === 1) {
      chunk[0].failed = res.error.code;
      return undefined;
    }
    for (let i = 0; i < chunk.length; i++) {
      const stop = await send(table, [chunk[i]], [rows[i]]);
      if (stop) return stop;
    }
    return undefined;
  };

  outer: for (const step of STEPS) {
    const groups = new Map<string, { entries: Entry[]; rows: RemoteRow[] }>();
    for (const e of entries.values()) {
      const row = e.table === step.table && e.row && !e.failed ? step.select(e.row) : null;
      if (!row) continue;
      const sig = Object.keys(row).sort().join(',');
      const g = groups.get(sig) ?? { entries: [], rows: [] };
      g.entries.push(e);
      g.rows.push(row);
      groups.set(sig, g);
    }
    for (const g of groups.values()) {
      for (let i = 0; i < g.rows.length; i += CHUNK_SIZE) {
        abort = await send(step.table, g.entries.slice(i, i + CHUNK_SIZE), g.rows.slice(i, i + CHUNK_SIZE));
        if (abort) break outer;
      }
    }
  }

  for (const e of entries.values()) if (e.row && !e.skip && !e.failed && e.need > 0 && e.ok === e.need) sent.set(keyOf(e.table, e.recordId), JSON.stringify(e.row));
  return { ...(await settle(repo, log, entries.values(), dead, abort)), more: live.length >= PEEK_LIMIT, deferred };
}
