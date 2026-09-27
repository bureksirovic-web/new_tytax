import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type CookieOptions = Record<string, unknown>;
interface CookieMethods {
  getAll(): { name: string; value: string }[];
  setAll(cookies: { name: string; value: string; options: CookieOptions }[]): void;
}

const createServerClient = vi.fn<(url: string, key: string, opts: { cookies: CookieMethods }) => { tag: string }>(
  () => ({ tag: 'server-client' })
);
vi.mock('@supabase/ssr', () => ({
  createServerClient: (url: string, key: string, opts: { cookies: CookieMethods }) => createServerClient(url, key, opts),
}));

const store = {
  getAll: vi.fn(() => [{ name: 'sb-127-auth-token', value: 'tok' }]),
  set: vi.fn<(name: string, value: string, options?: CookieOptions) => void>(),
};
const cookies = vi.fn(async () => store);
vi.mock('next/headers', () => ({ cookies: () => cookies() }));

import { AuthNotConfiguredError } from '../env';
import { createClient } from '../server';

function configure(url = 'http://127.0.0.1:54421', key = 'anon-key') {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', url);
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', key);
}

/** The cookie adapter createClient handed to @supabase/ssr. */
function cookieAdapter(): CookieMethods {
  // 1: one createClient() call per test.
  expect(createServerClient).toHaveBeenCalledTimes(1);
  return createServerClient.mock.calls[0][2].cookies;
}

beforeEach(() => {
  createServerClient.mockClear();
  cookies.mockClear();
  store.getAll.mockClear();
  store.set.mockReset();
});

afterEach(() => vi.unstubAllEnvs());

describe('createClient (server)', () => {
  it('configured: builds the SSR client from the trimmed env and the request cookies', async () => {
    configure('  http://127.0.0.1:54421  ', ' anon-key ');
    await expect(createClient()).resolves.toEqual({ tag: 'server-client' });
    expect(createServerClient.mock.calls[0][0]).toBe('http://127.0.0.1:54421');
    expect(createServerClient.mock.calls[0][1]).toBe('anon-key');
    expect(cookies).toHaveBeenCalledTimes(1);
    expect(cookieAdapter().getAll()).toEqual([{ name: 'sb-127-auth-token', value: 'tok' }]);
  });

  it('setAll writes every cookie with its options', async () => {
    configure();
    await createClient();
    const options = { path: '/', httpOnly: true, maxAge: 3600 };
    cookieAdapter().setAll([
      { name: 'a', value: '1', options },
      { name: 'b', value: '2', options: {} },
    ]);
    expect(store.set.mock.calls).toEqual([
      ['a', '1', options],
      ['b', '2', {}],
    ]);
  });

  it('setAll from a Server Component (cookies read-only) is swallowed', async () => {
    configure();
    await createClient();
    store.set.mockImplementation(() => {
      throw new Error('Cookies can only be modified in a Server Action or Route Handler.');
    });
    expect(() => cookieAdapter().setAll([{ name: 'a', value: '1', options: {} }])).not.toThrow();
    expect(store.set).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['both missing', '', ''],
    ['url missing', '', 'anon-key'],
    ['key blank', 'http://127.0.0.1:54421', '   '],
  ])('unconfigured (%s): rejects with AuthNotConfiguredError before touching cookies', async (_label, url, key) => {
    configure(url, key);
    const error = await createClient().then(
      () => null,
      (e: unknown) => e
    );
    expect(error).toBeInstanceOf(AuthNotConfiguredError);
    expect((error as AuthNotConfiguredError).code).toBe('auth_not_configured');
    expect(cookies).not.toHaveBeenCalled();
    expect(createServerClient).not.toHaveBeenCalled();
  });
});
