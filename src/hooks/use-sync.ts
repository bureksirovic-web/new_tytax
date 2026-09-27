'use client';
/**
 * React bridge to sync: the adapter the providers installed into the
 * repository (src/components/providers/sync-bootstrap.tsx) and the signed-in
 * account. Flag off: state `{ status: 'disabled' }`, account `disabled`, and
 * nothing here touches the network or loads supabase-js.
 *
 * The server snapshot is always the disabled state, so the first client
 * render matches the server HTML; the real state follows right after hydration.
 */
import { useCallback, useSyncExternalStore } from 'react';
import { noopSyncAdapter, type SyncResult, type SyncState } from '@/contracts/sync';
// The leaf modules, not the '@/lib/sync' barrel: the barrel pulls the real
// adapter, mapper and remote store into the first load of every page that
// shows the sync panel; they arrive with the deferred adapter's import() instead.
import { DISABLED_ACCOUNT, getAccountStore, type AccountState } from '@/lib/sync/account';
import { getInstalledSyncAdapter } from '@/lib/sync/install';

const serverState = (): SyncState => noopSyncAdapter.getState();
const serverAccount = (): AccountState => DISABLED_ACCOUNT;

/** Current sync state of the installed adapter. */
export function useSyncState(): SyncState {
  const adapter = getInstalledSyncAdapter();
  return useSyncExternalStore(adapter.subscribe, adapter.getState, serverState);
}

/** Signed-in account (`disabled` when sync is off). */
export function useAccount(): AccountState {
  const store = getAccountStore();
  return useSyncExternalStore(store.subscribe, store.getState, serverAccount);
}

export interface UseSyncResult {
  enabled: boolean;
  state: SyncState;
  account: AccountState;
  syncNow(): Promise<SyncResult>;
  signOut(): Promise<void>;
  /** Legacy aliases (pre-v2 sync-status). */
  isSyncing: boolean;
  pendingCount: number;
  lastSync: string | null;
  sync(): Promise<SyncResult>;
}

export function useSync(): UseSyncResult {
  const adapter = getInstalledSyncAdapter();
  const state = useSyncState();
  const account = useAccount();
  const syncNow = useCallback((): Promise<SyncResult> => adapter.syncNow(), [adapter]);
  const signOut = useCallback((): Promise<void> => getAccountStore().signOut(), []);
  return {
    // From the snapshot, not the adapter: during hydration the snapshot is the
    // server's (disabled), so the first client render matches the server HTML.
    enabled: state.status !== 'disabled',
    state,
    account,
    syncNow,
    signOut,
    isSyncing: state.status === 'syncing',
    pendingCount: state.pending,
    lastSync: state.lastSyncedAt,
    sync: syncNow,
  };
}
