/**
 * The Supabase `SyncAdapter` (src/contracts/sync.ts): single-flight runs of
 * claim → push → pull, non-blocking backoff retries, and observable state.
 * Pure TS: the repository, remote, storage, clock and timers are injected.
 */
import type { Repository } from '@/contracts/repo';
import type { SyncAdapter, SyncResult, SyncState } from '@/contracts/sync';
import { PUSH_ORDER } from './columns';
import { createCursorStore, type SyncStorage } from './cursors';
import { AUTH_REQUIRED, NETWORK_ERROR, type RemoteError } from './errors';
import { consoleSyncLogger, type SyncLogger } from './log';
import { pullRun } from './pull';
import { pushRun, type SnapshotScope } from './push';
import type { RemoteStore } from './remote';
import { DEBOUNCE_MS, backoffDelay, readLastSynced, writeLastSynced } from './timing';

export { BACKOFF_BASE_MS, BACKOFF_CAP_MS, DEBOUNCE_MS, backoffDelay } from './timing';

type TimerId = ReturnType<typeof setTimeout>;

/** `lastError` while ops of another account's profile stay queued on this device. */
export const OTHER_ACCOUNT = 'other_account';
/** Push rounds per run (200 ops each) before the run moves on to the pull. */
const MAX_PUSH_ROUNDS = 50;

export interface SupabaseSyncAdapterOptions {
  /** The repository, or a getter (the repository is usually built with this adapter). */
  repo: Repository | (() => Repository);
  remote: RemoteStore;
  storage: SyncStorage;
  now?: () => Date;
  setTimeout?: (fn: () => void, ms: number) => TimerId;
  clearTimeout?: (id: TimerId) => void;
  isOnline?: () => boolean;
  /** Jitter source in [0, 1). */
  random?: () => number;
  log?: SyncLogger;
  pageSize?: number;
  /** Push rounds per run before the pull (default MAX_PUSH_ROUNDS); a backlog left over schedules a follow-up run. */
  maxPushRounds?: number;
  /** Byte budget per upsert (default MAX_PUSH_BYTES in push.ts). */
  maxPushBytes?: number;
}

export interface SupabaseSyncAdapter extends SyncAdapter {
  readonly remote: RemoteStore;
  /** Called on the browser `offline` event. */
  markOffline(): void;
  /** Cancels pending debounce/retry timers. */
  dispose(): void;
}

const defaultOnline = (): boolean => typeof navigator === 'undefined' || navigator.onLine !== false;

export function createSupabaseSyncAdapter(opts: SupabaseSyncAdapterOptions): SupabaseSyncAdapter {
  const repo = (): Repository => (typeof opts.repo === 'function' ? opts.repo() : opts.repo);
  const { remote, storage } = opts;
  const now = opts.now ?? (() => new Date());
  const setTimer = opts.setTimeout ?? ((fn, ms) => setTimeout(fn, ms));
  const clearTimer = opts.clearTimeout ?? ((id) => clearTimeout(id));
  const isOnline = opts.isOnline ?? defaultOnline;
  const random = opts.random ?? Math.random;
  const log = opts.log ?? consoleSyncLogger;
  const cursors = createCursorStore(storage);

  let state: SyncState = { status: 'idle', lastSyncedAt: readLastSynced(storage), pending: 0 };
  const listeners = new Set<(s: SyncState) => void>();
  let inflight: Promise<SyncResult> | null = null;
  let debounceTimer: TimerId | null = null;
  let retryTimer: TimerId | null = null;
  let attempt = 0;
  let rerun = false;
  let claiming = false;

  const setState = (patch: Partial<SyncState>): void => {
    const next: SyncState = { ...state, ...patch };
    if (!('lastError' in patch) && patch.status && patch.status !== 'error') delete next.lastError;
    state = next;
    for (const l of listeners) {
      try {
        l(state);
      } catch {
        // A listener never breaks sync.
      }
    }
  };

  const refreshPending = async (): Promise<number> => {
    try {
      const pending = await repo().outbox.count();
      if (pending !== state.pending) setState({ pending });
      return pending;
    } catch {
      return state.pending;
    }
  };

  const scheduleRetry = (error: RemoteError): void => {
    if (retryTimer) clearTimer(retryTimer);
    const delay = backoffDelay(attempt, random);
    attempt += 1;
    log({ event: 'retry', code: error.code, count: delay });
    retryTimer = setTimer(() => {
      retryTimer = null;
      void adapter.syncNow();
    }, delay);
  };

  const result = (pushed: number, pulled: number, failed: number): SyncResult => ({ pushed, pulled, failed, state });

  /** Local profiles without an account get this one (SyncTable `profiles` owner). */
  const claim = async (accountId: string): Promise<void> => {
    claiming = true;
    try {
      for (const p of await repo().profiles.list()) {
        if (p.accountId === undefined) await repo().profiles.update(p.id, { accountId });
      }
    } finally {
      claiming = false;
    }
  };

  const stopWith = async (error: RemoteError, pushed: number, pulled: number, failed: number): Promise<SyncResult> => {
    const offline = error.retryable && !isOnline();
    setState({ status: offline ? 'offline' : 'error', lastError: error.code, pending: await refreshPending() });
    if (error.retryable && !offline) scheduleRetry(error);
    return result(pushed, pulled, failed);
  };

  const run = async (): Promise<SyncResult> => {
    setState({ status: 'syncing' });
    if (!isOnline()) {
      setState({ status: 'offline', pending: await refreshPending() });
      return result(0, 0, 0);
    }
    let accountId: string | null;
    try {
      accountId = await remote.currentAccountId();
    } catch {
      return stopWith(NETWORK_ERROR, 0, 0, 0);
    }
    if (!accountId) return stopWith(AUTH_REQUIRED, 0, 0, 0);
    const r = repo();
    await claim(accountId);
    const deps = { repo: r, remote, cursors, log, pageSize: opts.pageSize };
    let pulled = 0;

    // First run for this account on this device (or the cursor store was
    // lost): pull everything first, so the snapshot pushes only what the
    // server does not have and never a stale copy over a newer server row.
    const firstPush = cursors.get(accountId, 'profiles').lastPushedAt === null;
    let snapshot: SnapshotScope | null = null;
    if (firstPush) {
      const known = new Set<string>();
      const pre = await pullRun(deps, accountId, { full: true, seen: known });
      pulled += pre.pulled;
      if (pre.abort) return stopWith(pre.abort, 0, pulled, 0);
      snapshot = { known };
    }

    const totals = { pushed: 0, failed: 0, deferred: 0, permanentCode: undefined as string | undefined };
    const sent = new Map<string, string>();
    const maxRounds = opts.maxPushRounds ?? MAX_PUSH_ROUNDS;
    // Set when the round budget runs out while the outbox still makes progress:
    // the rest is drained by a follow-up run (after this run's pull), never left
    // waiting for an unrelated trigger.
    let backlog = false;
    for (let round = 0; round < maxRounds; round++) {
      const push = await pushRun({ repo: r, remote, log, maxPushBytes: opts.maxPushBytes }, accountId, round === 0 ? snapshot : null, sent);
      totals.pushed += push.pushed;
      totals.failed += push.failed;
      totals.deferred = push.deferred;
      totals.permanentCode = push.permanentCode ?? totals.permanentCode;
      if (push.abort) return stopWith(push.abort, totals.pushed, pulled, totals.failed);
      // A full peek window: drain the backlog now instead of waiting for the next trigger.
      if (!push.more || push.settled === 0) break;
      if (round === maxRounds - 1) backlog = true;
    }
    const stamp = now().toISOString();
    if (firstPush) for (const t of PUSH_ORDER) cursors.set(accountId, t, { lastPushedAt: stamp });

    // After a snapshot run's full pull, pull again only if this run changed the server.
    if (!firstPush || totals.pushed > 0) {
      const pull = await pullRun(deps, accountId);
      pulled += pull.pulled;
      if (pull.abort) return stopWith(pull.abort, totals.pushed, pulled, totals.failed);
    }

    attempt = 0;
    if (retryTimer) {
      clearTimer(retryTimer);
      retryTimer = null;
    }
    const pending = await refreshPending();
    if (backlog && pending > 0) rerun = true; // syncNow's finally re-arms the debounce
    if (totals.failed > 0) {
      setState({ status: 'error', lastError: totals.permanentCode, pending });
    } else if (totals.deferred > 0) {
      // Ops of a profile owned by another account never leave this device
      // while this account is signed in: not "up to date".
      setState({ status: 'error', lastError: OTHER_ACCOUNT, pending });
    } else {
      const lastSyncedAt = now().toISOString();
      writeLastSynced(storage, lastSyncedAt);
      setState({ status: 'idle', lastSyncedAt, pending });
    }
    return result(totals.pushed, pulled, totals.failed);
  };

  const adapter: SupabaseSyncAdapter = {
    enabled: true,
    remote,

    notifyChanged() {
      if (claiming) return;
      void refreshPending();
      if (debounceTimer) clearTimer(debounceTimer);
      debounceTimer = setTimer(() => {
        debounceTimer = null;
        if (inflight) rerun = true;
        else void adapter.syncNow();
      }, DEBOUNCE_MS);
    },

    syncNow() {
      if (inflight) return inflight;
      inflight = run()
        .catch(async (): Promise<SyncResult> => stopWith({ code: 'internal', retryable: true }, 0, 0, 0))
        .finally(() => {
          inflight = null;
          if (rerun) {
            rerun = false;
            adapter.notifyChanged();
          }
        });
      return inflight;
    },

    getState: () => state,

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    markOffline() {
      setState({ status: 'offline' });
    },

    dispose() {
      if (debounceTimer) clearTimer(debounceTimer);
      if (retryTimer) clearTimer(retryTimer);
      debounceTimer = null;
      retryTimer = null;
      listeners.clear();
    },
  };
  return adapter;
}
