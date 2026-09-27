/**
 * Pull: per table in push order, page from the cursor (5 s overlap on the
 * first page, keyset after that), map, apply, and only then advance the
 * cursor. A row that does not map is skipped (logged as `invalid_row`) and
 * holds the persisted cursor before it for the rest of the run, so it is
 * re-read on every run rather than lost.
 *
 * Applying a page (docs/v2/sync-schema.md "Pull"): the server row wins for
 * every record without a queued local op. Device clocks never decide:
 * `Repository.applyRemote` compares the pulled `updatedAt` (server time) with
 * the local one (device time), so a pulled row whose content differs from the
 * local copy is handed over with `updatedAt` raised just past the local one.
 * The pending-op check and the apply run in one IndexedDB transaction, so a
 * local edit either commits before it (and is skipped here) or after it
 * (and wins locally and on the next push).
 */
import type { Repository } from '@/contracts/repo';
import type { SyncTable } from '@/contracts/sync';
import { PUSH_ORDER, remoteTableOf } from './columns';
import { pullSince, type CursorStore } from './cursors';
import type { RemoteError } from './errors';
import type { SyncLogger } from './log';
import { fromRemote, type LocalRecord } from './mapper';
import { keyOf, pendingRecordKeys } from './outbox-ops';
import { BACKUP_KEY } from './backup-keys';
import type { RemoteStore } from './remote';

export const PULL_PAGE = 500;
/** Safety valve against a server that never returns a short page. */
const MAX_PAGES = 2_000;

export interface PullDeps {
  repo: Repository;
  remote: RemoteStore;
  cursors: CursorStore;
  log: SyncLogger;
  pageSize?: number;
}

export interface PullOptions {
  /** Ignore the cursors and read every row (the first-push snapshot run). */
  full?: boolean;
  /** Collects `table:id` of every row the server returned. */
  seen?: Set<string>;
}

export interface PullOutcome {
  pulled: number;
  abort?: RemoteError;
}

export const APPLY_FAILED: RemoteError = Object.freeze({ code: 'apply_failed', retryable: true });

function later(a: string | null, b: string): boolean {
  if (a === null) return true;
  const x = Date.parse(a);
  const y = Date.parse(b);
  return !Number.isFinite(x) || !Number.isFinite(y) || y >= x;
}

/** Fields that never make two copies of a record different. */
const VOLATILE = new Set(['updatedAt', 'syncedAt']);

/** Stable JSON with sorted keys; null and undefined members are dropped (the mapper maps one to the other). */
function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`;
  if (v !== null && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    const keys = Object.keys(o)
      .filter((k) => o[k] !== undefined && o[k] !== null)
      .sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonical(o[k])}`).join(',')}}`;
  }
  return JSON.stringify(v) ?? 'null';
}

export function sameContent(a: LocalRecord, b: LocalRecord): boolean {
  const strip = (r: LocalRecord) => Object.fromEntries(Object.entries(r).filter(([k]) => !VOLATILE.has(k)));
  return canonical(strip(a)) === canonical(strip(b));
}

/** Local copies of every record, read once per run (`table:id` → record). */
type LocalIndex = () => Promise<Map<string, LocalRecord>>;

function localIndexOf(repo: Repository): LocalIndex {
  let index: Promise<Map<string, LocalRecord>> | null = null;
  return () => {
    index ??= repo.exportBackup().then((backup) => {
      const map = new Map<string, LocalRecord>();
      for (const table of PUSH_ORDER) {
        for (const rec of backup[BACKUP_KEY[table]] as unknown as LocalRecord[]) map.set(keyOf(table, String(rec.id)), rec);
      }
      return map;
    });
    return index;
  };
}

/** Server wins for records without a queued op; see the module comment. */
async function applyPage(repo: Repository, table: SyncTable, records: LocalRecord[], local: LocalIndex): Promise<number> {
  const copies = await local();
  return repo.transaction(async () => {
    const pending = await pendingRecordKeys(repo.outbox);
    const out: LocalRecord[] = [];
    for (const rec of records) {
      const key = keyOf(table, String(rec.id));
      if (pending.has(key)) continue;
      const mine = copies.get(key);
      if (mine && sameContent(mine, rec)) continue;
      const remoteTime = Date.parse(String(rec.updatedAt));
      const localTime = Date.parse(String(mine?.updatedAt));
      const next = Number.isFinite(localTime) && !(remoteTime > localTime) ? { ...rec, updatedAt: new Date(localTime + 1).toISOString() } : rec;
      out.push(next);
      copies.set(key, next);
    }
    return out.length === 0 ? 0 : (await repo.applyRemote(table, out)).applied;
  });
}

export async function pullRun(deps: PullDeps, accountId: string, opts: PullOptions = {}): Promise<PullOutcome> {
  let pulled = 0;
  const local = localIndexOf(deps.repo);
  for (const table of PUSH_ORDER) {
    const res = await pullTable(deps, accountId, table, local, opts);
    pulled += res.pulled;
    if (res.abort) return { pulled, abort: res.abort };
  }
  return { pulled };
}

async function pullTable(deps: PullDeps, accountId: string, table: SyncTable, local: LocalIndex, opts: PullOptions): Promise<PullOutcome> {
  const { repo, remote, cursors, log } = deps;
  const limit = deps.pageSize ?? PULL_PAGE;
  const remoteTable = remoteTableOf(table);
  const seen = new Set<string>();
  let since = opts.full ? null : pullSince(cursors.get(accountId, table));
  let afterId: string | null = null;
  let pulled = 0;
  // Set by the first row this client cannot map: from there on the run keeps
  // paging and applying, but the persisted cursor stays before that row, so
  // every later run re-reads it (it lands once it maps) instead of losing it.
  let held = false;
  for (let page = 0; page < MAX_PAGES; page++) {
    const res = await remote.pull(remoteTable, since, afterId, limit);
    if (!res.ok) return { pulled, abort: res.error };
    const rows = res.rows;
    const records: LocalRecord[] = [];
    let invalid = 0;
    /** Last row of this page the persisted cursor may move to. */
    let lastSafe: (typeof rows)[number] | undefined;
    for (const row of rows) {
      const id = String(row.id);
      opts.seen?.add(keyOf(table, id));
      if (seen.has(id)) {
        if (!held) lastSafe = row;
        continue;
      }
      seen.add(id);
      try {
        records.push(fromRemote(table, row));
        if (!held) lastSafe = row;
      } catch {
        invalid += 1;
        held = true;
      }
    }
    if (invalid > 0) log({ event: 'skip', table, code: 'invalid_row', count: invalid });
    if (records.length > 0) {
      try {
        pulled += await applyPage(repo, table, records, local);
      } catch {
        return { pulled, abort: APPLY_FAILED };
      }
    }
    if (lastSafe && typeof lastSafe.updated_at === 'string') {
      const current = cursors.get(accountId, table).lastPulledAt;
      if (later(current, lastSafe.updated_at)) cursors.set(accountId, table, { lastPulledAt: lastSafe.updated_at, lastPulledId: String(lastSafe.id) });
    }
    const last = rows[rows.length - 1];
    if (last && typeof last.updated_at === 'string') {
      since = last.updated_at;
      afterId = String(last.id);
    }
    if (rows.length < limit || !last) break;
  }
  return { pulled };
}
