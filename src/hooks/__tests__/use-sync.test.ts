import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { noopSyncAdapter, type SyncAdapter, type SyncState } from '@/contracts/sync';
import * as sync from '@/lib/sync';
import { resetAccountStoreForTests, resetSyncAdapterForTests } from '@/lib/sync';
import { useAccount, useSync, useSyncState } from '../use-sync';

vi.mock('@supabase/ssr', () => {
  throw new Error('flag off must never import @supabase/ssr');
});

/** A minimal enabled adapter whose state the test drives. */
function drivenAdapter(initial: SyncState) {
  let state = initial;
  const listeners = new Set<(s: SyncState) => void>();
  const adapter: SyncAdapter = {
    enabled: true,
    notifyChanged: () => {},
    syncNow: vi.fn(async () => ({ pushed: 1, pulled: 2, failed: 0, state })),
    getState: () => state,
    subscribe: (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
  };
  const set = (next: SyncState) => {
    state = next;
    listeners.forEach((l) => l(state));
  };
  return { adapter, set };
}

describe('use-sync', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_SYNC_ENABLED', '');
    fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    resetSyncAdapterForTests();
    resetAccountStoreForTests();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    resetSyncAdapterForTests();
    resetAccountStoreForTests();
  });

  it('flag off: disabled state and account, syncNow resolves disabled, zero network', async () => {
    const { result } = renderHook(() => useSync());
    expect(result.current.enabled).toBe(false);
    expect(result.current.state).toEqual({ status: 'disabled', lastSyncedAt: null, pending: 0 });
    expect(result.current.account).toEqual({ status: 'disabled', email: null });
    expect(result.current.isSyncing).toBe(false);
    expect(result.current.pendingCount).toBe(0);
    expect(result.current.lastSync).toBeNull();

    let out: Awaited<ReturnType<typeof result.current.syncNow>> | undefined;
    await act(async () => {
      out = await result.current.syncNow();
      await result.current.signOut();
    });
    expect(out?.state.status).toBe('disabled');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('useSyncState follows the installed adapter; syncNow goes through it', async () => {
    const { adapter, set } = drivenAdapter({ status: 'idle', lastSyncedAt: null, pending: 2 });
    vi.spyOn(sync, 'getInstalledSyncAdapter').mockReturnValue(adapter);

    const { result } = renderHook(() => ({ state: useSyncState(), all: useSync() }));
    expect(result.current.state.pending).toBe(2);
    expect(result.current.all.enabled).toBe(true);

    act(() => set({ status: 'syncing', lastSyncedAt: null, pending: 2 }));
    expect(result.current.state.status).toBe('syncing');
    expect(result.current.all.isSyncing).toBe(true);

    act(() => set({ status: 'idle', lastSyncedAt: '2026-09-26T10:00:00.000Z', pending: 0 }));
    expect(result.current.all.lastSync).toBe('2026-09-26T10:00:00.000Z');
    expect(result.current.all.pendingCount).toBe(0);

    await act(async () => {
      await result.current.all.sync();
    });
    expect(adapter.syncNow).toHaveBeenCalledTimes(1);
  });

  it('useAccount reads the account store', () => {
    const signedIn = { status: 'signed_in', email: 'ana@example.com' } as const;
    vi.spyOn(sync, 'getAccountStore').mockReturnValue({
      getState: () => signedIn,
      subscribe: () => () => {},
      signOut: async () => {},
    });
    const { result } = renderHook(() => useAccount());
    expect(result.current).toEqual({ status: 'signed_in', email: 'ana@example.com' });
    expect(sync.getInstalledSyncAdapter()).toBe(noopSyncAdapter);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
