// @vitest-environment jsdom
// (node env is not usable: the shared src/test-setup.ts touches window.)
/**
 * PLAN §7 threat sketch: the service worker must never store or replay a
 * response that depends on who is signed in. public/sw.js caches same-origin
 * page navigations by pathname, so this suite pins the two facts that make
 * that safe:
 *   1. the worker never intercepts /auth/**, /api/** or cross-origin requests
 *      (Supabase REST/auth is cross-origin), run against the real sw.js;
 *   2. no page, layout or route outside src/app/auth and src/app/api reads the
 *      session on the server, so every HTML the worker can cache is the same
 *      for every account (all user data lives in IndexedDB, which the worker
 *      never touches).
 * A future page that renders per-account HTML fails (2) and must either live
 * under /auth or be excluded in sw.js first.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

const ROOT = path.resolve(__dirname, '../..');
const ORIGIN = 'http://localhost:3110';

type Listener = (event: unknown) => void;

function loadWorker() {
  const listeners: Record<string, Listener> = {};
  const cachePut = vi.fn();
  const cache = { put: cachePut, match: vi.fn(async () => undefined), addAll: vi.fn() };
  const context = {
    self: {
      location: { href: `${ORIGIN}/sw.js`, origin: ORIGIN },
      addEventListener: (type: string, fn: Listener) => {
        listeners[type] = fn;
      },
      skipWaiting: vi.fn(),
      clients: { claim: vi.fn() },
    },
    caches: { open: vi.fn(async () => cache), match: vi.fn(async () => undefined), keys: vi.fn(async () => []) },
    fetch: vi.fn(async () => new Response('<html></html>', { status: 200 })),
    URL,
    Response,
    Set,
    Promise,
    console,
  };
  vm.createContext(context);
  vm.runInContext(readFileSync(path.join(ROOT, 'public/sw.js'), 'utf8'), context);
  return { listeners, cachePut };
}

function dispatchFetch(listeners: Record<string, Listener>, url: string, mode: string) {
  const respondWith = vi.fn();
  listeners.fetch({ request: { method: 'GET', url, mode }, respondWith });
  return respondWith;
}

describe('service worker: account-scoped responses are never intercepted', () => {
  const { listeners } = loadWorker();

  it.each([
    ['/auth/account', 'navigate'],
    ['/auth/login?error=auth_exchange_failed', 'navigate'],
    ['/auth/callback?code=abc&next=/dashboard', 'navigate'],
    ['/api/health', 'cors'],
    ['/api/anything/else', 'navigate'],
  ])('same-origin %s (%s) goes straight to the network', (p, mode) => {
    expect(dispatchFetch(listeners, `${ORIGIN}${p}`, mode)).not.toHaveBeenCalled();
  });

  it.each([
    'https://project.supabase.co/rest/v1/workout_logs?select=*',
    'https://project.supabase.co/auth/v1/user',
    'http://127.0.0.1:54421/rest/v1/profiles',
  ])('cross-origin %s is not intercepted', (u) => {
    expect(dispatchFetch(listeners, u, 'cors')).not.toHaveBeenCalled();
  });

  it('a shell navigation is intercepted (the check above is not vacuous)', () => {
    expect(dispatchFetch(listeners, `${ORIGIN}/dashboard`, 'navigate')).toHaveBeenCalledTimes(1);
  });

  it('a CACHE_URLS message cannot smuggle /auth or /api pages into the cache', async () => {
    const { listeners: l, cachePut } = loadWorker();
    let work: Promise<unknown> = Promise.resolve();
    l.message({
      data: { type: 'CACHE_URLS', urls: ['/auth/account', '/api/health', 'https://evil.test/x'] },
      ports: [],
      waitUntil: (p: Promise<unknown>) => {
        work = p;
      },
    });
    await work;
    const keys = cachePut.mock.calls.map((c) => String(c[0]));
    expect(keys.some((k) => k.includes('/auth/') || k.includes('/api/') || k.includes('evil.test'))).toBe(false);
  });
});

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return name === '__tests__' ? [] : walk(full);
    return /\.(ts|tsx)$/.test(name) ? [full] : [];
  });
}

describe('pages the worker may cache render the same HTML for every account', () => {
  const appDir = path.join(ROOT, 'src/app');
  const cacheable = walk(appDir).filter((f) => {
    const rel = path.relative(appDir, f).split(path.sep);
    return rel[0] !== 'auth' && rel[0] !== 'api';
  });

  it('finds the app routes (guard against an empty walk)', () => {
    expect(cacheable.some((f) => f.endsWith(path.join('dashboard', 'page.tsx')))).toBe(true);
  });

  it.each([
    ['next/headers', /from\s+['"]next\/headers['"]/],
    ['@/lib/supabase/server', /from\s+['"]@\/lib\/supabase\/server['"]/],
    ['@supabase/ssr', /from\s+['"]@supabase\/ssr['"]/],
  ])('no cacheable page, layout or route imports %s', (_name, re) => {
    const offenders = cacheable.filter((f) => re.test(readFileSync(f, 'utf8'))).map((f) => path.relative(ROOT, f));
    expect(offenders).toEqual([]);
  });
});
