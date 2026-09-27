// @vitest-environment jsdom
// (node env is not usable: the shared src/test-setup.ts touches window.)
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { unstable_doesMiddlewareMatch } from 'next/experimental/testing/server';

type CookieToSet = { name: string; value: string; options: Record<string, unknown> };
type CookieMethods = { getAll: () => unknown; setAll: (cookies: CookieToSet[]) => void };

const getUser = vi.fn();
const createServerClient = vi.fn((_url: string, _key: string, opts: { cookies: CookieMethods }) => {
  void opts;
  return { auth: { getUser } };
});

vi.mock('@supabase/ssr', () => ({
  createServerClient: (url: string, key: string, opts: { cookies: CookieMethods }) =>
    createServerClient(url, key, opts),
}));

import { config, proxy } from '../proxy';

const URL_ = 'http://127.0.0.1:54421';

function req(path = '/dashboard', cookie?: string) {
  return new NextRequest(`https://app.test${path}`, {
    headers: cookie ? { cookie } : undefined,
  });
}

function configure({ sync }: { sync: boolean }) {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', URL_);
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon-key');
  vi.stubEnv('NEXT_PUBLIC_SYNC_ENABLED', sync ? 'true' : '');
}

let fetchSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  getUser.mockReset();
  createServerClient.mockClear();
  fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network call in test'));
});

afterEach(() => {
  vi.unstubAllEnvs();
  fetchSpy.mockRestore();
});

/** `x-middleware-next: 1` is how Next marks a pass-through response. */
function isNext(res: Response) {
  return res.headers.get('x-middleware-next') === '1';
}

describe('proxy: local-first short circuits', () => {
  it('sync flag off: passes through without creating a client or calling the network', async () => {
    configure({ sync: false });
    const res = await proxy(req());
    expect(res.status).toBe(200);
    expect(isNext(res)).toBe(true);
    expect(createServerClient).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('sync flag set to anything but "true" counts as off', async () => {
    configure({ sync: false });
    vi.stubEnv('NEXT_PUBLIC_SYNC_ENABLED', '1');
    const res = await proxy(req());
    expect(isNext(res)).toBe(true);
    expect(createServerClient).not.toHaveBeenCalled();
  });

  it('Supabase not configured (sync on): passes through without a client', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', '   ');
    vi.stubEnv('NEXT_PUBLIC_SYNC_ENABLED', 'true');
    const res = await proxy(req());
    expect(res.status).toBe(200);
    expect(isNext(res)).toBe(true);
    expect(createServerClient).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('proxy: session refresh', () => {
  it('configured + sync on: calls getUser with the env and request cookies', async () => {
    configure({ sync: true });
    getUser.mockResolvedValue({ data: { user: null }, error: null });
    const res = await proxy(req('/dashboard', 'sb-access=old'));
    expect(res.status).toBe(200);
    expect(createServerClient).toHaveBeenCalledTimes(1);
    const [url, key, opts] = createServerClient.mock.calls[0];
    expect([url, key]).toEqual([URL_, 'anon-key']);
    expect(opts.cookies.getAll()).toEqual([{ name: 'sb-access', value: 'old' }]);
    expect(getUser).toHaveBeenCalledTimes(1);
  });

  it('propagates cookies set during the refresh to the response and the forwarded request', async () => {
    configure({ sync: true });
    getUser.mockImplementation(async () => {
      const opts = createServerClient.mock.calls[0][2];
      opts.cookies.setAll([
        { name: 'sb-access', value: 'new-token', options: { path: '/', httpOnly: true, sameSite: 'lax' } },
      ]);
      return { data: { user: { id: 'u1' } }, error: null };
    });
    const res = await proxy(req('/dashboard', 'sb-access=old'));
    const setCookie = res.headers.get('set-cookie') ?? '';
    expect(setCookie).toContain('sb-access=new-token');
    expect(setCookie).toContain('HttpOnly');
    expect(res.cookies.get('sb-access')?.value).toBe('new-token');
    // The rebuilt response forwards the refreshed cookie to the page render.
    expect(res.headers.get('x-middleware-request-cookie')).toContain('sb-access=new-token');
    expect(isNext(res)).toBe(true);
  });

  it('getUser throws: still a 200 pass-through, no throw', async () => {
    configure({ sync: true });
    getUser.mockRejectedValue(new Error('fetch failed'));
    const res = await proxy(req());
    expect(res.status).toBe(200);
    expect(isNext(res)).toBe(true);
    expect(getUser).toHaveBeenCalledTimes(1);
  });

  it('createServerClient throws: still a 200 pass-through', async () => {
    configure({ sync: true });
    createServerClient.mockImplementationOnce(() => {
      throw new Error('bad url');
    });
    const res = await proxy(req());
    expect(res.status).toBe(200);
    expect(isNext(res)).toBe(true);
    expect(getUser).not.toHaveBeenCalled();
  });
});

describe('proxy matcher', () => {
  const matches = (url: string) => unstable_doesMiddlewareMatch({ config, url });

  it.each([
    '/',
    '/dashboard',
    '/workout/active',
    '/auth/login',
    '/auth/callback?code=x',
    '/api/healthz',
    '/settings/manifest.json.page',
  ])('runs on %s', (url) => {
    expect(matches(url)).toBe(true);
  });

  it.each([
    '/_next/static/chunks/main.js',
    '/_next/image?url=%2Fa.png&w=64&q=75',
    '/api/health',
    '/sw.js',
    '/workbox-4754cb34.js',
    '/swe-worker-5c72df51bb1f6ee0.js',
    '/manifest.json',
    '/favicon.ico',
    '/icons/icon-192.png',
    '/offline.html',
    '/globe.svg',
  ])('skips %s', (url) => {
    expect(matches(url)).toBe(false);
  });
});
