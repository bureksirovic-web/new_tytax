import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

import { createClient } from '@/lib/supabase/server';

function createMockRequest(body?: unknown) {
  return new NextRequest('http://localhost/api/workout', {
    method: body ? 'POST' : 'GET',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

function createMockUser(id = 'user-123') {
  return { id, email: 'test@example.com' };
}

describe('GET /api/workout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when not authenticated', async () => {
    const mockSupabase = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    };
    vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

    const { GET } = await import('../route');
    const response = await GET();

    expect(response.status).toBe(401);
    const json = await response.json();
    expect(json.error).toBe('Unauthorized');
  });

  it('returns workout logs when authenticated', async () => {
    const mockLogs = [
      { id: 'log-1', sessionName: 'Leg Day', date: '2024-01-01' },
      { id: 'log-2', sessionName: 'Push Day', date: '2024-01-02' },
    ];
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: createMockUser() } }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            is: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({ data: mockLogs, error: null }),
              }),
            }),
          }),
        }),
      }),
    };
    vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

    const { GET } = await import('../route');
    const response = await GET();

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.data).toEqual(mockLogs);
    expect(mockSupabase.from).toHaveBeenCalledWith('workout_logs');
  });

  it('returns 500 when database query fails', async () => {
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: createMockUser() } }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            is: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({
                  data: null,
                  error: { message: 'Database error' },
                }),
              }),
            }),
          }),
        }),
      }),
    };
    vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

    const { GET } = await import('../route');
    const response = await GET();

    expect(response.status).toBe(500);
    const json = await response.json();
    expect(json.error).toBe('Database error');
  });
});

describe('POST /api/workout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when not authenticated', async () => {
    const mockSupabase = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    };
    vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

    const { POST } = await import('../route');
    const request = createMockRequest({});
    const response = await POST(request);

    expect(response.status).toBe(401);
  });

  it('returns 400 when body is invalid (missing required fields)', async () => {
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: createMockUser() } }),
      },
    };
    vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

    const { POST } = await import('../route');
    const request = createMockRequest({ sessionName: 'Test' });
    const response = await POST(request);

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBe('Validation failed');
    expect(json.details).toBeDefined();
  });

  it('returns 400 when body has wrong types', async () => {
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: createMockUser() } }),
      },
    };
    vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

    const { POST } = await import('../route');
    const request = createMockRequest({
      id: 123,
      sessionName: 'Test',
      date: '2024-01-01',
      startedAt: '2024-01-01T00:00:00Z',
      finishedAt: '2024-01-01T01:00:00Z',
      durationSeconds: 'not-a-number',
      exercises: [],
      totalVolumeKg: 100,
      totalSets: 5,
      prCount: 0,
      modalitiesUsed: ['strength'],
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    });
    const response = await POST(request);

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBe('Validation failed');
  });

  it('successfully creates a workout log with valid body', async () => {
    const validBody = {
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
    };

    const createdLog = { ...validBody, profile_id: 'user-123' };
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: createMockUser() } }),
      },
      from: vi.fn().mockReturnValue({
        upsert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: createdLog, error: null }),
          }),
        }),
      }),
    };
    vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

    const { POST } = await import('../route');
    const request = createMockRequest(validBody);
    const response = await POST(request);

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.data).toEqual(createdLog);
    expect(mockSupabase.from).toHaveBeenCalledWith('workout_logs');
  });

  it('strips unknown fields from body', async () => {
    const bodyWithUnknown = {
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
      unknownField: 'should be stripped',
      anotherUnknown: 12345,
    };

    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: createMockUser() } }),
      },
      from: vi.fn().mockReturnValue({
        upsert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: 'log-1', sessionName: 'Leg Day' },
              error: null,
            }),
          }),
        }),
      }),
    };
    vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

    const { POST } = await import('../route');
    const request = createMockRequest(bodyWithUnknown);
    const response = await POST(request);

    expect(response.status).toBe(200);
    const upsertCall = vi.mocked(mockSupabase.from).mock.results[0].value.upsert;
    const upsertedData = upsertCall.mock.calls[0][0];
    expect(upsertedData).not.toHaveProperty('unknownField');
    expect(upsertedData).not.toHaveProperty('anotherUnknown');
  });

  it('returns 500 when database upsert fails', async () => {
    const validBody = {
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
    };

    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: createMockUser() } }),
      },
      from: vi.fn().mockReturnValue({
        upsert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'Constraint violation' },
            }),
          }),
        }),
      }),
    };
    vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

    const { POST } = await import('../route');
    const request = createMockRequest(validBody);
    const response = await POST(request);

    expect(response.status).toBe(500);
    const json = await response.json();
    expect(json.error).toBe('Constraint violation');
  });
});
