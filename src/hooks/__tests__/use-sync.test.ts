import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSync } from '../use-sync';
import * as syncEngineModule from '@/lib/sync/engine';
import * as dexieReactHooksModule from 'dexie-react-hooks';

vi.mock('@/lib/db/dexie', () => {
  const mockDb = {
    syncQueue: {
      count: vi.fn().mockResolvedValue(3),
    },
    syncMetadata: {
      where: vi.fn().mockReturnValue({
        equals: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue({
            id: 'meta-1',
            deviceId: 'test-device',
            lastSyncedAt: '2026-03-01T10:00:00.000Z',
          }),
        }),
      }),
    },
  };
  return { db: mockDb };
});

vi.mock('@/lib/sync/engine', () => ({
  syncEngine: {
    sync: vi.fn(),
  },
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      upsert: vi.fn().mockResolvedValue({ error: null }),
    }),
  }),
}));

vi.mock('dexie-react-hooks', () => ({
  useLiveQuery: vi.fn(),
}));

describe('useSync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('test-device');
    vi.mocked(dexieReactHooksModule.useLiveQuery).mockImplementation(
      () => 3
    );
  });

  it('returns sync status from engine', async () => {
    const { result } = renderHook(() => useSync());

    expect(result.current.isSyncing).toBe(false);
    expect(result.current.pendingCount).toBe(3);
  });

  it('triggerSync calls syncEngine.sync', async () => {
    vi.mocked(syncEngineModule.syncEngine.sync).mockResolvedValue({
      status: 'ok',
      synced: 2,
      failed: 0,
      pending: 1,
    });

    const { result } = renderHook(() => useSync());

    await act(async () => {
      await result.current.sync();
    });

    expect(syncEngineModule.syncEngine.sync).toHaveBeenCalled();
  });

  it('handles sync errors', async () => {
    vi.mocked(syncEngineModule.syncEngine.sync).mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useSync());

    await act(async () => {
      try {
        await result.current.sync();
      } catch {
        // Expected error
      }
    });

    expect(result.current.isSyncing).toBe(false);
  });

  it('sets isSyncing to true during sync', async () => {
    let resolveSync: () => void;
    const syncPromise = new Promise<void>((resolve) => {
      resolveSync = resolve;
    });
    vi.mocked(syncEngineModule.syncEngine.sync).mockReturnValue(syncPromise as unknown as Promise<{ status: 'ok'; synced: number; failed: number; pending: number }>);

    const { result } = renderHook(() => useSync());

    act(() => {
      result.current.sync();
    });

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(result.current.isSyncing).toBe(true);

    resolveSync!();
    await syncPromise;
  });

  it('returns lastResult after successful sync', async () => {
    const expectedResult = {
      status: 'ok' as const,
      synced: 5,
      failed: 0,
      pending: 0,
    };
    vi.mocked(syncEngineModule.syncEngine.sync).mockResolvedValue(expectedResult);

    const { result } = renderHook(() => useSync());

    await act(async () => {
      await result.current.sync();
    });

    expect(result.current.lastResult).toEqual(expectedResult);
  });

  it('handles null lastSyncMeta when no deviceId', async () => {
    (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(null);

    const { result } = renderHook(() => useSync());

    expect(result.current.lastSync).toBe(null);
  });
});
