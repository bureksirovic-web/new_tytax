/**
 * A tiny `SyncAdapter` that is `enabled` from the moment it exists and loads
 * the real adapter lazily. Installed synchronously into the repository at
 * app start (./install.ts), it makes the repository queue outbox ops from the
 * very first write, while the sync code itself (adapter, mapper, supabase-js)
 * stays out of the first-load bundle and arrives with a dynamic `import()`.
 *
 * Until the real adapter is loaded: `notifyChanged` starts the load (and is
 * forwarded afterwards), `syncNow` waits for it, state is a plain `idle`.
 * Keep this file free of heavy imports.
 */
import type { SyncAdapter, SyncResult, SyncState } from '@/contracts/sync';

export interface DeferredSyncAdapter extends SyncAdapter {
  /** Loads (once) and returns the real adapter; a failed load is retried on the next call. */
  load(): Promise<SyncAdapter>;
}

const INITIAL: SyncState = Object.freeze({ status: 'idle', lastSyncedAt: null, pending: 0 }) as SyncState;

export function createDeferredSyncAdapter(loadReal: () => Promise<SyncAdapter>): DeferredSyncAdapter {
  let real: SyncAdapter | null = null;
  let loading: Promise<SyncAdapter> | null = null;
  let state: SyncState = INITIAL;
  let notifyPending = false;
  const listeners = new Set<(s: SyncState) => void>();

  const emit = (next: SyncState): void => {
    state = next;
    for (const l of listeners) {
      try {
        l(state);
      } catch {
        // A listener never breaks sync.
      }
    }
  };

  const load = (): Promise<SyncAdapter> => {
    loading ??= loadReal().then(
      (adapter) => {
        real = adapter;
        adapter.subscribe(emit);
        emit(adapter.getState());
        if (notifyPending) {
          notifyPending = false;
          adapter.notifyChanged();
        }
        return adapter;
      },
      (error: unknown) => {
        loading = null;
        throw error;
      },
    );
    return loading;
  };

  return {
    enabled: true,
    load,
    notifyChanged() {
      if (real) return real.notifyChanged();
      notifyPending = true;
      load().catch(() => {});
    },
    async syncNow(): Promise<SyncResult> {
      try {
        return await (await load()).syncNow();
      } catch {
        // The sync chunk could not be loaded (offline first visit, deploy in between).
        emit({ ...state, status: 'error', lastError: 'network' });
        return { pushed: 0, pulled: 0, failed: 0, state };
      }
    },
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
