// @vitest-environment jsdom
// (node env is not usable: the shared src/test-setup.ts touches window.)
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const signInWithOtp = vi.fn();
const authSignOut = vi.fn();
const authGetSession = vi.fn();
const createClient = vi.fn(() => ({
  auth: { signInWithOtp, signOut: authSignOut, getSession: authGetSession },
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => createClient(),
}));

import { getSession, signInWithMagicLink, signOut } from '../helpers';

function configure() {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://127.0.0.1:54421');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon-key');
  vi.stubEnv('NEXT_PUBLIC_APP_URL', ' https://tytax.test/ ');
}

beforeEach(() => {
  signInWithOtp.mockReset();
  authSignOut.mockReset();
  authGetSession.mockReset();
  createClient.mockClear();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('signInWithMagicLink', () => {
  it('rejects an invalid email without calling Supabase', async () => {
    configure();
    const res = await signInWithMagicLink('not-an-email');
    expect(res.error?.code).toBe('invalid_email');
    expect(createClient).not.toHaveBeenCalled();
    expect(signInWithOtp).not.toHaveBeenCalled();
  });

  it('returns auth_not_configured (no throw) when Supabase env is missing', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', '');
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://tytax.test');
    await expect(signInWithMagicLink('a@b.co')).resolves.toMatchObject({
      error: { code: 'auth_not_configured' },
    });
    expect(createClient).not.toHaveBeenCalled();
  });

  it('returns auth_not_configured (no throw) when there is no app origin and no window (SSR)', async () => {
    configure();
    vi.stubEnv('NEXT_PUBLIC_APP_URL', '');
    vi.stubGlobal('window', undefined);
    expect(typeof window).toBe('undefined');
    const res = await signInWithMagicLink('a@b.co');
    expect(res.error?.code).toBe('auth_not_configured');
    expect(signInWithOtp).not.toHaveBeenCalled();
  });

  it('builds emailRedirectTo from NEXT_PUBLIC_APP_URL with an encoded safe next', async () => {
    configure();
    signInWithOtp.mockResolvedValue({ data: {}, error: null });
    const res = await signInWithMagicLink('  lifter@example.com ', '/settings?tab=sync');
    expect(res.error).toBeNull();
    expect(signInWithOtp).toHaveBeenCalledWith({
      email: 'lifter@example.com',
      options: {
        emailRedirectTo: 'https://tytax.test/auth/callback?next=%2Fsettings%3Ftab%3Dsync',
      },
    });
  });

  it('replaces an unsafe next with /dashboard in the redirect URL', async () => {
    configure();
    signInWithOtp.mockResolvedValue({ data: {}, error: null });
    await signInWithMagicLink('lifter@example.com', '//evil.com');
    const { emailRedirectTo } = signInWithOtp.mock.calls[0][0].options;
    expect(emailRedirectTo).toBe('https://tytax.test/auth/callback?next=%2Fdashboard');
    expect(emailRedirectTo).not.toContain('evil');
  });

  it('falls back to window.location.origin when NEXT_PUBLIC_APP_URL is unset', async () => {
    configure();
    vi.stubEnv('NEXT_PUBLIC_APP_URL', '');
    vi.stubGlobal('window', { location: { origin: 'http://localhost:3105' } });
    signInWithOtp.mockResolvedValue({ data: {}, error: null });
    await signInWithMagicLink('lifter@example.com');
    const { emailRedirectTo } = signInWithOtp.mock.calls[0][0].options;
    expect(emailRedirectTo).toBe('http://localhost:3105/auth/callback?next=%2Fdashboard');
  });

  it.each(['ftp://tytax.test', 'javascript:alert(1)', 'data:text/html,x'])(
    'ignores a non-http(s) NEXT_PUBLIC_APP_URL (%s) and uses the window origin',
    async (bad) => {
      configure();
      vi.stubEnv('NEXT_PUBLIC_APP_URL', bad);
      vi.stubGlobal('window', { location: { origin: 'http://localhost:3105' } });
      signInWithOtp.mockResolvedValue({ data: {}, error: null });
      await signInWithMagicLink('lifter@example.com');
      const { emailRedirectTo } = signInWithOtp.mock.calls[0][0].options;
      expect(emailRedirectTo).toBe('http://localhost:3105/auth/callback?next=%2Fdashboard');
    }
  );

  it('a non-http(s) NEXT_PUBLIC_APP_URL with no window → auth_not_configured, Supabase not called', async () => {
    configure();
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'ftp://tytax.test');
    vi.stubGlobal('window', undefined);
    const res = await signInWithMagicLink('lifter@example.com');
    expect(res.error?.code).toBe('auth_not_configured');
    expect(signInWithOtp).not.toHaveBeenCalled();
  });

  it('maps a Supabase {error} to send_failed', async () => {
    configure();
    signInWithOtp.mockResolvedValue({ data: {}, error: { message: 'Email rate limit exceeded' } });
    const res = await signInWithMagicLink('lifter@example.com');
    expect(res.error).toEqual({ code: 'send_failed', message: 'Email rate limit exceeded' });
  });

  it('maps a thrown error to send_failed', async () => {
    configure();
    signInWithOtp.mockRejectedValue(new Error('fetch failed'));
    const res = await signInWithMagicLink('lifter@example.com');
    expect(res.error?.code).toBe('send_failed');
  });
});

describe('signOut / getSession when not configured', () => {
  it('signOut is a safe no-op', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '');
    await expect(signOut()).resolves.toBeUndefined();
    expect(createClient).not.toHaveBeenCalled();
  });

  it('getSession returns a null session without error', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', '');
    await expect(getSession()).resolves.toEqual({ data: { session: null }, error: null });
    expect(createClient).not.toHaveBeenCalled();
  });

  it('signOut calls Supabase when configured', async () => {
    configure();
    authSignOut.mockResolvedValue({ error: null });
    await signOut();
    expect(authSignOut).toHaveBeenCalledTimes(1);
  });
});

describe('getSession when configured', () => {
  it('logs only the error message, never the error object or its token-like fields', async () => {
    configure();
    const secret = 'eyJhbGciOiJIUzI1NiJ9.SECRET-REFRESH-TOKEN';
    const authError = Object.assign(new Error('Invalid Refresh Token'), {
      status: 400,
      refresh_token: secret,
      context: { access_token: secret },
    });
    authGetSession.mockResolvedValue({ data: { session: null }, error: authError });
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) =>
      vi.spyOn(console, m).mockImplementation(() => {})
    );
    const res = await getSession();
    expect(res).toEqual({ data: { session: null }, error: authError });
    const calls = spies.flatMap((s) => s.mock.calls.flat());
    expect(calls.length).toBeGreaterThan(0);
    for (const arg of calls) {
      expect(typeof arg).toBe('string');
      expect(arg as string).not.toContain(secret);
    }
    expect(calls.join(' ')).toContain('Invalid Refresh Token');
    spies.forEach((s) => s.mockRestore());
  });
});
