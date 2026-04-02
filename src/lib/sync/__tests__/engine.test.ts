import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSyncQueue = vi.hoisted(() => ({
  toArray: vi.fn(),
  delete: vi.fn(),
  update: vi.fn(),
}));

const mockSyncMetadata = vi.hoisted(() => ({
  where: vi.fn(),
  update: vi.fn(),
}));

vi.mock('@/lib/db/dexie', () => ({
  db: {
    syncQueue: mockSyncQueue,
    syncMetadata: mockSyncMetadata,
  },
}));

const { SyncEngine } = await import('../engine');
import type { SyncOperation } from '@/types/sync';

describe('SyncEngine', () => {
  let engine: InstanceType<typeof SyncEngine>;

  beforeEach(() => {
    vi.clearAllMocks();
    engine = new SyncEngine();
  });

  function makeOp(overrides: Partial<SyncOperation> = {}): SyncOperation {
    return {
      id: 'op-1',
      tableName: 'workout_logs',
      operationType: 'create',
      recordId: 'rec-1',
      payload: { id: 'rec-1', name: 'Test' },
      createdAt: '2024-01-01T00:00:00.000Z',
      retryCount: 0,
      ...overrides,
    };
  }

  function setupSupabaseResponse(error: unknown = null) {
    const mockChain = {
      upsert: vi.fn().mockResolvedValue({ error }),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ error }),
    };
    const mockClient = {
      from: vi.fn().mockReturnValue(mockChain),
    };
    return { mockChain, mockClient };
  }

  it('sync() processes pending operations', async () => {
    const ops: SyncOperation[] = [
      makeOp({ id: 'op-1', operationType: 'create' }),
      makeOp({ id: 'op-2', operationType: 'update' }),
    ];
    mockSyncQueue.toArray.mockResolvedValue(ops);
    const { mockClient } = setupSupabaseResponse(null);
    mockSyncQueue.delete.mockResolvedValue(undefined);
    mockSyncMetadata.where.mockReturnValue({
      equals: vi.fn().mockReturnValue({
        first: vi.fn().mockResolvedValue({ id: 'meta-1', deviceId: 'server' }),
      }),
    });
    mockSyncMetadata.update.mockResolvedValue(undefined);

    const result = await engine.sync(mockClient as any);

    expect(result.status).toBe('ok');
    expect(result.synced).toBe(2);
    expect(result.failed).toBe(0);
    expect(mockSyncQueue.delete).toHaveBeenCalledTimes(2);
  });

  it('respects isSyncing guard (no double-sync)', async () => {
    mockSyncQueue.toArray.mockResolvedValue([]);
    mockSyncMetadata.where.mockReturnValue({
      equals: vi.fn().mockReturnValue({
        first: vi.fn().mockResolvedValue(undefined),
      }),
    });

    const result1 = engine.sync({} as any);
    const result2 = engine.sync({} as any);

    const [r1, r2] = await Promise.all([result1, result2]);

    expect(r1.status).toBe('ok');
    expect(r2.status).toBe('busy');
    expect(r2.synced).toBe(0);
  });

  it('handles Supabase errors properly', async () => {
    const ops: SyncOperation[] = [makeOp()];
    mockSyncQueue.toArray.mockResolvedValue(ops);
    const { mockClient } = setupSupabaseResponse(new Error('Supabase error'));
    mockSyncQueue.update.mockResolvedValue(undefined);
    mockSyncMetadata.where.mockReturnValue({
      equals: vi.fn().mockReturnValue({
        first: vi.fn().mockResolvedValue(undefined),
      }),
    });

    const result = await engine.sync(mockClient as any);

    expect(result.status).toBe('ok');
    expect(result.failed).toBe(1);
    expect(result.synced).toBe(0);
    expect(mockSyncQueue.update).toHaveBeenCalledWith('op-1', {
      retryCount: 1,
      lastError: expect.stringContaining('Supabase error'),
    });
  });

  it('retries failed operations with backoff', async () => {
    vi.useFakeTimers();

    const ops: SyncOperation[] = [makeOp({ retryCount: 1 })];
    mockSyncQueue.toArray.mockResolvedValue(ops);
    const { mockClient } = setupSupabaseResponse(null);
    mockSyncQueue.delete.mockResolvedValue(undefined);
    mockSyncMetadata.where.mockReturnValue({
      equals: vi.fn().mockReturnValue({
        first: vi.fn().mockResolvedValue(undefined),
      }),
    });

    const syncPromise = engine.sync(mockClient as any);

    await vi.advanceTimersByTimeAsync(2000);

    const result = await syncPromise;

    expect(result.synced).toBe(1);
    expect(mockSyncQueue.delete).toHaveBeenCalledWith('op-1');

    vi.useRealTimers();
  });

  it('stops retrying after MAX_RETRIES', async () => {
    const ops: SyncOperation[] = [makeOp({ retryCount: 5 })];
    mockSyncQueue.toArray.mockResolvedValue(ops);
    mockSyncMetadata.where.mockReturnValue({
      equals: vi.fn().mockReturnValue({
        first: vi.fn().mockResolvedValue(undefined),
      }),
    });

    const result = await engine.sync({} as any);

    expect(result.failed).toBe(1);
    expect(result.synced).toBe(0);
  });

  it('processes delete operations with soft delete', async () => {
    const ops: SyncOperation[] = [makeOp({ operationType: 'delete' })];
    mockSyncQueue.toArray.mockResolvedValue(ops);

    const mockUpdateChain = { update: vi.fn().mockReturnThis() };
    const mockEqChain = { eq: vi.fn().mockResolvedValue({ error: null }) };
    mockUpdateChain.update.mockReturnValue(mockEqChain);
    const mockClient = { from: vi.fn().mockReturnValue(mockUpdateChain) };

    mockSyncQueue.delete.mockResolvedValue(undefined);
    mockSyncMetadata.where.mockReturnValue({
      equals: vi.fn().mockReturnValue({
        first: vi.fn().mockResolvedValue(undefined),
      }),
    });

    const result = await engine.sync(mockClient as any);

    expect(result.synced).toBe(1);
    expect(mockClient.from).toHaveBeenCalledWith('workout_logs');
    expect(mockEqChain.eq).toHaveBeenCalledWith('id', 'rec-1');
  });
});
