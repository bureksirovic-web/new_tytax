// @vitest-environment jsdom
// (node env is not usable: the shared src/test-setup.ts touches window.)
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { NextRequest } from 'next/server';

const exchangeCodeForSession = vi.fn();
const createClient = vi.fn(async () => ({ auth: { exchangeCodeForSession } }));

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => createClient(),
}));

import { GET } from '../route';
import { AuthNotConfiguredError } from '@/lib/supabase/env';

const ORIGIN = 'https://app.test';
const SECRET_CODE = 'pkce-code-7f3a9c-SECRET';

function req(query: string) {
  return new NextRequest(`${ORIGIN}/auth/callback${query}`);
}

let logSpies: MockInstance[] = [];

function loggedText(): string {
  return logSpies.flatMap((s) => s.mock.calls.flat().map((a) => String(a))).join('\n');
}

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://127.0.0.1:54421');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon-key');
  exchangeCodeForSession.mockReset();
  createClient.mockClear();
  logSpies = (['log', 'info', 'warn', 'error'] as const).map((m) =>
    vi.spyOn(console, m).mockImplementation(() => {})
  );
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('GET /auth/callback', () => {
  it('provider error param → login with sanitized code, no exchange, no description echoed', async () => {
    const res = await GET(
      req('?error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+%3Cscript%3E')
    );
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe(`${ORIGIN}/auth/login?error=otp_expired`);
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it('provider error with an unsafe code → auth_failed', async () => {
    const res = await GET(req('?error=https%3A%2F%2Fevil.com&code=' + SECRET_CODE));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe(`${ORIGIN}/auth/login?error=auth_failed`);
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it('missing env → auth_not_configured', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', '   ');
    const res = await GET(req(`?code=${SECRET_CODE}`));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe(`${ORIGIN}/auth/login?error=auth_not_configured`);
    expect(createClient).not.toHaveBeenCalled();
  });

  it('missing code → missing_code', async () => {
    const res = await GET(req('?next=/workout'));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe(`${ORIGIN}/auth/login?error=missing_code`);
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it('exchange returns {error} → auth_exchange_failed', async () => {
    exchangeCodeForSession.mockResolvedValue({ data: {}, error: { message: 'invalid grant', status: 400 } });
    const res = await GET(req(`?code=${SECRET_CODE}&next=/workout`));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe(`${ORIGIN}/auth/login?error=auth_exchange_failed`);
    expect(exchangeCodeForSession).toHaveBeenCalledWith(SECRET_CODE);
  });

  it('exchange throws → auth_exchange_failed', async () => {
    exchangeCodeForSession.mockRejectedValue(new Error('network down'));
    const res = await GET(req(`?code=${SECRET_CODE}`));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe(`${ORIGIN}/auth/login?error=auth_exchange_failed`);
    expect(exchangeCodeForSession).toHaveBeenCalledTimes(1);
  });

  it('createClient throws AuthNotConfiguredError → auth_not_configured (not exchange_failed)', async () => {
    createClient.mockRejectedValueOnce(new AuthNotConfiguredError());
    const res = await GET(req('?code=' + SECRET_CODE));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe(`${ORIGIN}/auth/login?error=auth_not_configured`);
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
    expect(loggedText()).toContain('"outcome":"auth_not_configured"');
    expect(loggedText()).not.toContain(SECRET_CODE);
  });

  it('success with allowed next → that path on the request origin, query preserved', async () => {
    exchangeCodeForSession.mockResolvedValue({ data: { session: {} }, error: null });
    const next = encodeURIComponent('/settings?tab=sync');
    const res = await GET(req(`?code=${SECRET_CODE}&next=${next}`));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe(`${ORIGIN}/settings?tab=sync`);
    expect(exchangeCodeForSession).toHaveBeenCalledWith(SECRET_CODE);
  });

  it('success without next → /dashboard', async () => {
    exchangeCodeForSession.mockResolvedValue({ data: { session: {} }, error: null });
    const res = await GET(req(`?code=${SECRET_CODE}`));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe(`${ORIGIN}/dashboard`);
  });

  it.each([
    '//evil.com',
    'https://evil.com',
    '/%2F%2Fevil.com',
    '/\\evil.com',
    '/dashboardevil',
  ])('success with evil next %j → /dashboard', async (evil) => {
    exchangeCodeForSession.mockResolvedValue({ data: { session: {} }, error: null });
    const res = await GET(req(`?code=${SECRET_CODE}&next=${encodeURIComponent(evil)}`));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe(`${ORIGIN}/dashboard`);
  });

  it('logs status + request id, never the code', async () => {
    exchangeCodeForSession.mockResolvedValue({ data: {}, error: { message: 'bad' } });
    await GET(req(`?code=${SECRET_CODE}`));
    exchangeCodeForSession.mockResolvedValue({ data: { session: {} }, error: null });
    await GET(req(`?code=${SECRET_CODE}&next=/workout`));
    const text = loggedText();
    expect(text).not.toContain(SECRET_CODE);
    expect(text).toMatch(/"status":307/);
    expect(text).toMatch(/"requestId":"[0-9a-f-]{36}"/);
  });
});
