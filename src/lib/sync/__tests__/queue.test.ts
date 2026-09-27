import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSyncQueue = vi.hoisted(() => ({
  where: vi.fn(),
  add: vi.fn(),
  update: vi.fn(),
}));

vi.mock('@/lib/db/dexie', () => ({
  getDb: () => ({
    syncQueue: mockSyncQueue,
  }),
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

    const payload = { id: 'rec-1', profileId: 'profile-1', name: 'Test' };
    await enqueue('workout_logs', 'create', 'rec-1', payload);

    expect(mockSyncQueue.where).toHaveBeenCalledWith({ recordId: 'rec-1', table: 'workout_logs' });
    expect(mockSyncQueue.add).toHaveBeenCalledWith({
      id: 'generated-id-123',
      table: 'workout_logs',
      op: 'upsert',
      recordId: 'rec-1',
      profileId: 'profile-1',
      createdAt: expect.any(String),
      retryCount: 0,
    });
  });

  it('deduplicates by updating an existing entry instead of creating a duplicate', async () => {
    const existingEntry = {
      id: 'existing-id',
      table: 'workout_logs',
      op: 'upsert',
      recordId: 'rec-1',
      profileId: 'profile-1',
      createdAt: '2024-01-01T00:00:00.000Z',
      retryCount: 0,
    };

    mockSyncQueue.where.mockReturnValue({
      first: vi.fn().mockResolvedValue(existingEntry),
    });

    await enqueue('workout_logs', 'update', 'rec-1', { id: 'rec-1', name: 'Updated' });

    expect(mockSyncQueue.add).not.toHaveBeenCalled();
    expect(mockSyncQueue.update).toHaveBeenCalledWith('existing-id', {
      op: 'upsert',
      profileId: 'profile-1',
      createdAt: expect.any(String),
    });
  });

  it('delete supersedes create/update', async () => {
    const existingEntry = {
      id: 'existing-id',
      table: 'programs',
      op: 'upsert',
      recordId: 'prog-1',
      profileId: 'profile-1',
      createdAt: '2024-01-01T00:00:00.000Z',
      retryCount: 0,
    };

    mockSyncQueue.where.mockReturnValue({
      first: vi.fn().mockResolvedValue(existingEntry),
    });

    await enqueue('programs', 'delete', 'prog-1', { id: 'prog-1' });

    expect(mockSyncQueue.update).toHaveBeenCalledWith('existing-id', {
      op: 'delete',
      profileId: 'profile-1',
      createdAt: expect.any(String),
    });
  });

  it('an existing delete entry stays a delete', async () => {
    const existingDelete = {
      id: 'del-id',
      table: 'profiles',
      op: 'delete',
      recordId: 'prof-1',
      profileId: 'prof-1',
      createdAt: '2024-01-01T00:00:00.000Z',
      retryCount: 0,
    };

    mockSyncQueue.where.mockReturnValue({
      first: vi.fn().mockResolvedValue(existingDelete),
    });

    await enqueue('profiles', 'update', 'prof-1', { id: 'prof-1', name: 'New' });

    expect(mockSyncQueue.update).toHaveBeenCalledWith('del-id', {
      op: 'delete',
      profileId: 'prof-1',
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
      await enqueue(table, 'upsert', 'rec-1', { id: 'rec-1' });
      expect(mockSyncQueue.add).toHaveBeenCalledWith(
        expect.objectContaining({ table, op: 'upsert', profileId: '' }),
      );
    }
  });
});
