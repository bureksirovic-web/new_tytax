import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

import { createClient } from '@/lib/supabase/server';

function createMockRequest(body: unknown) {
  return new NextRequest('http://localhost/api/sync', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

function createMockUser(id = 'user-123') {
  return { id, email: 'test@example.com' };
}

function createValidCreateOp(overrides = {}) {
  return {
    id: 'op-1',
    tableName: 'workout_logs',
    operationType: 'create',
    recordId: 'rec-1',
    payload: {
      id: 'log-1',
      sessionName: 'Leg Day',
      date: '2024-01-01',
      startedAt: '2024-01-01T00:00:00Z',
      finishedAt: '2024-01-01T01:00:00Z',
      durationSeconds: 3600,
      exercises: [],
      totalVolumeKg: 5000,
      totalSets: 10,
      prCount: 2,
      modalitiesUsed: ['strength'],
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    },
    createdAt: '2024-01-01T00:00:00Z',
    retryCount: 0,
    ...overrides,
  };
}

function createValidDeleteOp(overrides = {}) {
  return {
    id: 'op-2',
    tableName: 'workout_logs',
    operationType: 'delete',
    recordId: 'rec-1',
    payload: null,
    createdAt: '2024-01-01T00:00:00Z',
    retryCount: 0,
    ...overrides,
  };
}

describe('POST /api/sync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when not authenticated', async () => {
    const mockSupabase = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    };
    vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

    const { POST } = await import('../route');
    const request = createMockRequest({ operations: [] });
    const response = await POST(request);

    expect(response.status).toBe(401);
    const json = await response.json();
    expect(json.error).toBe('Unauthorized');
  });

  it('returns 400 when body is not valid JSON', async () => {
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: createMockUser() } }),
      },
    };
    vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

    const request = new NextRequest('http://localhost/api/sync', {
      method: 'POST',
      body: 'not valid json{{{',
    });

    const { POST } = await import('../route');
    const response = await POST(request);

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBe('Invalid JSON body');
  });

  it('returns 400 when body does not have operations array', async () => {
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: createMockUser() } }),
      },
    };
    vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

    const { POST } = await import('../route');

    const requestNoOps = createMockRequest({ data: [] });
    const responseNoOps = await POST(requestNoOps);
    expect(responseNoOps.status).toBe(400);

    const requestNullOps = createMockRequest({ operations: null });
    const responseNullOps = await POST(requestNullOps);
    expect(responseNullOps.status).toBe(400);

    const requestStringOps = createMockRequest({ operations: 'not-array' });
    const responseStringOps = await POST(requestStringOps);
    expect(responseStringOps.status).toBe(400);
  });

  it('processes valid create operations', async () => {
    const mockUpsert = vi.fn().mockResolvedValue({ data: {}, error: null });
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: createMockUser() } }),
      },
      from: vi.fn().mockReturnValue({
        upsert: mockUpsert.mockReturnValue({
          select: vi.fn().mockResolvedValue({ data: {}, error: null }),
        }),
      }),
    };
    vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

    const { POST } = await import('../route');
    const request = createMockRequest({
      operations: [createValidCreateOp()],
    });
    const response = await POST(request);

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.synced).toBe(1);
    expect(json.failed).toBe(0);
    expect(json.errors).toEqual([]);
    expect(mockSupabase.from).toHaveBeenCalledWith('workout_logs');
  });

  it('processes valid delete operations', async () => {
    const mockEq = vi.fn().mockResolvedValue({ data: {}, error: null });
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: createMockUser() } }),
      },
      from: vi.fn().mockReturnValue({ update: mockUpdate }),
    };
    vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

    const { POST } = await import('../route');
    const request = createMockRequest({
      operations: [createValidDeleteOp()],
    });
    const response = await POST(request);

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.synced).toBe(1);
    expect(json.failed).toBe(0);
    expect(json.errors).toEqual([]);
    expect(mockSupabase.from).toHaveBeenCalledWith('workout_logs');
  });

  it('rejects operations for disallowed tables', async () => {
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: createMockUser() } }),
      },
    };
    vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

    const { POST } = await import('../route');
    const request = createMockRequest({
      operations: [
        {
          id: 'op-bad',
          tableName: 'some_secret_table',
          operationType: 'create',
          recordId: 'rec-1',
          payload: { foo: 'bar' },
          createdAt: '2024-01-01T00:00:00Z',
          retryCount: 0,
        },
      ],
    });
    const response = await POST(request);

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.synced).toBe(0);
    expect(json.failed).toBe(1);
    expect(json.errors).toHaveLength(1);
    expect(json.errors[0]).toContain('some_secret_table');
    expect(json.errors[0]).toContain('not allowed');
  });

  it('rejects operations with invalid payload structure', async () => {
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: createMockUser() } }),
      },
    };
    vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

    const { POST } = await import('../route');

    const requestMissingFields = createMockRequest({
      operations: [
        {
          id: 'op-bad',
          tableName: 'workout_logs',
          operationType: 'create',
          recordId: 'rec-1',
          payload: { sessionName: 'Test' },
          createdAt: '2024-01-01T00:00:00Z',
          retryCount: 0,
        },
      ],
    });
    const response = await POST(requestMissingFields);

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.synced).toBe(0);
    expect(json.failed).toBe(1);
    expect(json.errors).toHaveLength(1);
    expect(json.errors[0]).toContain('op-bad');
  });

  it('handles mixed valid and invalid operations', async () => {
    const mockEq = vi.fn().mockResolvedValue({ data: {}, error: null });
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
    const mockUpsert = vi.fn().mockReturnValue({
      select: vi.fn().mockResolvedValue({ data: {}, error: null }),
    });

    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: createMockUser() } }),
      },
      from: vi.fn().mockReturnValue({
        upsert: mockUpsert,
        update: mockUpdate,
      }),
    };
    vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

    const { POST } = await import('../route');
    const request = createMockRequest({
      operations: [
        createValidCreateOp({ id: 'op-1' }),
        {
          id: 'op-bad',
          tableName: 'disallowed_table',
          operationType: 'create',
          recordId: 'rec-2',
          payload: {},
          createdAt: '2024-01-01T00:00:00Z',
          retryCount: 0,
        },
        createValidDeleteOp({ id: 'op-3', recordId: 'rec-3' }),
        {
          id: 'op-invalid',
          tableName: 'profiles',
          operationType: 'create',
          recordId: 'rec-4',
          payload: { displayName: 123 },
          createdAt: '2024-01-01T00:00:00Z',
          retryCount: 0,
        },
      ],
    });
    const response = await POST(request);

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.synced).toBe(2);
    expect(json.failed).toBe(2);
    expect(json.errors).toHaveLength(2);
  });

  it('rejects operations with invalid operation structure', async () => {
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: createMockUser() } }),
      },
    };
    vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

    const { POST } = await import('../route');
    const request = createMockRequest({
      operations: [
        {
          tableName: 'workout_logs',
          operationType: 'create',
        },
      ],
    });
    const response = await POST(request);

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.synced).toBe(0);
    expect(json.failed).toBe(1);
    expect(json.errors[0]).toContain('unknown');
  });

  it('rejects operations with invalid operationType', async () => {
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: createMockUser() } }),
      },
    };
    vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

    const { POST } = await import('../route');
    const request = createMockRequest({
      operations: [
        {
          id: 'op-bad-type',
          tableName: 'workout_logs',
          operationType: 'invalid_type',
          recordId: 'rec-1',
          payload: {},
          createdAt: '2024-01-01T00:00:00Z',
          retryCount: 0,
        },
      ],
    });
    const response = await POST(request);

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.synced).toBe(0);
    expect(json.failed).toBe(1);
    expect(json.errors[0]).toContain('invalid_type');
  });

  it('processes empty operations array successfully', async () => {
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: createMockUser() } }),
      },
    };
    vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

    const { POST } = await import('../route');
    const request = createMockRequest({ operations: [] });
    const response = await POST(request);

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.synced).toBe(0);
    expect(json.failed).toBe(0);
    expect(json.errors).toEqual([]);
  });

  it('sets profile_id for user-owned tables on create', async () => {
    const mockUpsert = vi.fn().mockReturnValue({
      select: vi.fn().mockResolvedValue({ data: {}, error: null }),
    });
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: createMockUser() } }),
      },
      from: vi.fn().mockReturnValue({
        upsert: mockUpsert,
      }),
    };
    vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

    const { POST } = await import('../route');
    const request = createMockRequest({
      operations: [createValidCreateOp()],
    });
    await POST(request);

    const upsertPayload = mockUpsert.mock.calls[0][0];
    expect(upsertPayload.profile_id).toBe('user-123');
  });

  it('does not overwrite profile_id for profiles table', async () => {
    const mockUpsert = vi.fn().mockReturnValue({
      select: vi.fn().mockResolvedValue({ data: {}, error: null }),
    });
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: createMockUser() } }),
      },
      from: vi.fn().mockReturnValue({
        upsert: mockUpsert,
      }),
    };
    vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

    const { POST } = await import('../route');
    const request = createMockRequest({
      operations: [
        {
          id: 'op-profile',
          tableName: 'profiles',
          operationType: 'update',
          recordId: 'user-123',
          payload: {
            displayName: 'Test User',
            language: 'en',
            unitSystem: 'metric',
            theme: 'dark',
            warmupStrategy: 'standard',
            autoBackup: true,
            barWeightKg: 20,
            isAnonymous: false,
          },
          createdAt: '2024-01-01T00:00:00Z',
          retryCount: 0,
        },
      ],
    });
    await POST(request);

    const upsertPayload = mockUpsert.mock.calls[0][0];
    expect(upsertPayload).not.toHaveProperty('profile_id');
  });
});
