import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

import { createClient } from '@/lib/supabase/server';

function createMockRequest(body?: unknown) {
  return new NextRequest('http://localhost/api/profile', {
    method: body ? 'POST' : 'GET',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

function createMockUser(id = 'user-123') {
  return { id, email: 'test@example.com' };
}

describe('GET /api/profile', () => {
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

  it('returns profile when authenticated', async () => {
    const mockProfile = {
      id: 'user-123',
      displayName: 'Test User',
      language: 'en',
      unitSystem: 'metric',
      theme: 'dark',
      warmupStrategy: 'standard',
      autoBackup: true,
      barWeightKg: 20,
      isAnonymous: false,
    };
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: createMockUser() } }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: mockProfile, error: null }),
          }),
        }),
      }),
    };
    vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

    const { GET } = await import('../route');
    const response = await GET();

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.data).toEqual(mockProfile);
    expect(mockSupabase.from).toHaveBeenCalledWith('profiles');
  });

  it('returns 500 when database query fails', async () => {
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: createMockUser() } }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'Profile not found' },
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
    expect(json.error).toBe('Profile not found');
  });
});

describe('POST /api/profile', () => {
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

  it('returns 400 when body is invalid', async () => {
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: createMockUser() } }),
      },
    };
    vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

    const { POST } = await import('../route');
    const request = createMockRequest({ displayName: 'Test' });
    const response = await POST(request);

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBe('Validation failed');
    expect(json.details).toBeDefined();
  });

  it('successfully updates profile with valid body', async () => {
    const validBody = {
      displayName: 'Test User',
      language: 'en',
      unitSystem: 'metric',
      theme: 'dark',
      warmupStrategy: 'standard',
      autoBackup: true,
      barWeightKg: 20,
      isAnonymous: false,
    };

    const updatedProfile = { ...validBody, id: 'user-123' };
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: createMockUser() } }),
      },
      from: vi.fn().mockReturnValue({
        upsert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: updatedProfile, error: null }),
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
    expect(json.data).toEqual(updatedProfile);
    expect(mockSupabase.from).toHaveBeenCalledWith('profiles');
  });

  it('strips unknown fields from body', async () => {
    const bodyWithUnknown = {
      displayName: 'Test User',
      language: 'en',
      unitSystem: 'metric',
      theme: 'dark',
      warmupStrategy: 'standard',
      autoBackup: true,
      barWeightKg: 20,
      isAnonymous: false,
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
              data: { id: 'user-123', displayName: 'Test User' },
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
      displayName: 'Test User',
      language: 'en',
      unitSystem: 'metric',
      theme: 'dark',
      warmupStrategy: 'standard',
      autoBackup: true,
      barWeightKg: 20,
      isAnonymous: false,
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
              error: { message: 'Update failed' },
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
    expect(json.error).toBe('Update failed');
  });
});
