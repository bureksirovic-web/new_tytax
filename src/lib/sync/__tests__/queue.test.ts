import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSyncQueue = vi.hoisted(() => ({
  where: vi.fn(),
  add: vi.fn(),
  update: vi.fn(),
}));

vi.mock('@/lib/db/dexie', () => ({
  db: {
    syncQueue: mockSyncQueue,
  },
}));

vi.mock('@/lib/utils', () => ({
  generateId: () => 'generated-id-123',
}));

const { enqueue } = await import('../queue');
import type { SyncableTable } from '../queue';

describe('enqueue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a new entry for a new record', async () => {
    mockSyncQueue.where.mockReturnValue({
      first: vi.fn().mockResolvedValue(undefined),
    });

    const payload = { id: 'rec-1', name: 'Test' };
    await enqueue('workout_logs', 'create', 'rec-1', payload);

    expect(mockSyncQueue.add).toHaveBeenCalledWith({
      id: 'generated-id-123',
      tableName: 'workout_logs',
      operationType: 'create',
      recordId: 'rec-1',
      payload,
      createdAt: expect.any(String),
      retryCount: 0,
    });
  });

  it('deduplicates by updating an existing entry instead of creating a duplicate', async () => {
    const existingEntry = {
      id: 'existing-id',
      tableName: 'workout_logs',
      operationType: 'create',
      recordId: 'rec-1',
      payload: { id: 'rec-1', name: 'Old' },
      createdAt: '2024-01-01T00:00:00.000Z',
      retryCount: 0,
    };

    mockSyncQueue.where.mockReturnValue({
      first: vi.fn().mockResolvedValue(existingEntry),
    });

    const newPayload = { id: 'rec-1', name: 'Updated' };
    await enqueue('workout_logs', 'update', 'rec-1', newPayload);

    expect(mockSyncQueue.add).not.toHaveBeenCalled();
    expect(mockSyncQueue.update).toHaveBeenCalledWith('existing-id', {
      operationType: 'update',
      payload: newPayload,
      createdAt: expect.any(String),
    });
  });

  it('delete supersedes create/update', async () => {
    const existingEntry = {
      id: 'existing-id',
      tableName: 'programs',
      operationType: 'create',
      recordId: 'prog-1',
      payload: { id: 'prog-1', name: 'Test Program' },
      createdAt: '2024-01-01T00:00:00.000Z',
      retryCount: 0,
    };

    mockSyncQueue.where.mockReturnValue({
      first: vi.fn().mockResolvedValue(existingEntry),
    });

    await enqueue('programs', 'delete', 'prog-1', { id: 'prog-1' });

    expect(mockSyncQueue.update).toHaveBeenCalledWith('existing-id', {
      operationType: 'delete',
      payload: { id: 'prog-1' },
      createdAt: expect.any(String),
    });
  });

  it('delete supersedes an existing delete entry', async () => {
    const existingDelete = {
      id: 'del-id',
      tableName: 'profiles',
      operationType: 'delete',
      recordId: 'prof-1',
      payload: { id: 'prof-1' },
      createdAt: '2024-01-01T00:00:00.000Z',
      retryCount: 0,
    };

    mockSyncQueue.where.mockReturnValue({
      first: vi.fn().mockResolvedValue(existingDelete),
    });

    await enqueue('profiles', 'update', 'prof-1', { id: 'prof-1', name: 'New' });

    expect(mockSyncQueue.update).toHaveBeenCalledWith('del-id', {
      operationType: 'delete',
      payload: { id: 'prof-1', name: 'New' },
      createdAt: expect.any(String),
    });
  });

  it('uses the correct table name type', async () => {
    mockSyncQueue.where.mockReturnValue({
      first: vi.fn().mockResolvedValue(undefined),
    });

    const tables: SyncableTable[] = [
      'workout_logs',
      'programs',
      'profiles',
      'pr_records',
      'bodyweight_entries',
    ];

    for (const table of tables) {
      await enqueue(table, 'create', 'rec-1', { id: 'rec-1' });
      expect(mockSyncQueue.add).toHaveBeenCalledWith(
        expect.objectContaining({ tableName: table }),
      );
    }
  });
});
