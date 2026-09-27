import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { classifyRemoteError, isDeadLetter } from '../errors';
import { createLazyRemoteStore, createSupabaseRemoteStore, type RemoteStore } from '../remote';

interface Response {
  data: unknown;
  error: { code?: string; message?: string } | null;
  status: number;
}

/** A chainable, thenable stand-in for the postgrest query builder that records every call. */
function fakeClient(responses: Array<Response | Error>) {
  const calls: Array<[string, ...unknown[]]> = [];
  const builder = (): Record<string, unknown> => {
    const b: Record<string, unknown> = {};
    for (const m of ['select', 'upsert', 'gte', 'or', 'order', 'limit']) {
      b[m] = (...args: unknown[]) => {
        calls.push([m, ...args]);
        return b;
      };
    }
    b.then = (resolve: (v: Response) => unknown, reject: (e: unknown) => unknown) => {
      const next = responses.shift();
      return next instanceof Error ? Promise.reject(next).then(resolve, reject) : Promise.resolve(next as Response).then(resolve, reject);
    };
    return b;
  };
  let authCb: ((event: string, session: { user: { id: string } } | null) => void) | undefined;
  const unsubscribe = vi.fn();
  const client = {
    from: (t: string) => {
      calls.push(['from', t]);
      return builder();
    },
    rpc: (fn: string, args: unknown) => {
      calls.push(['rpc', fn, args]);
      return builder();
    },
    auth: {
      getSession: vi.fn(async () => ({ data: { session: { user: { id: 'acc-1' } } } })),
      onAuthStateChange: (cb: typeof authCb) => {
        authCb = cb;
        return { data: { subscription: { unsubscribe } } };
      },
    },
  };
  return { client: client as unknown as SupabaseClient, calls, emit: (e: string, id: string | null) => authCb?.(e, id ? { user: { id } } : null), unsubscribe, auth: client.auth };
}

describe('classifyRemoteError', () => {
  it.each([
    [{ status: 401, code: '42501' }, { code: 'auth_required', retryable: false, authRequired: true }],
    [{ status: 401, code: 'PGRST303' }, { code: 'auth_required', retryable: false, authRequired: true }],
    [{ status: 403, code: '42501' }, { code: '42501', retryable: false }],
    [{ status: 409, code: '23505' }, { code: '23505', retryable: false }],
    [{ status: 409, code: '23503' }, { code: '23503', retryable: false }],
    [{ status: 400, code: '23514' }, { code: '23514', retryable: false }],
    [{ status: 400, code: '22P02' }, { code: '22P02', retryable: false }],
    [{ status: 413, code: 'PT413' }, { code: 'PT413', retryable: false }],
    [{ status: 400, code: 'PGRST204' }, { code: 'PGRST204', retryable: true }],
    [{ status: 0, code: '' }, { code: 'network', retryable: true }],
    [{}, { code: 'network', retryable: true }],
    [{ status: 429 }, { code: '429', retryable: true }],
    [{ status: 503, code: null }, { code: '503', retryable: true }],
    [{ status: 403 }, { code: '403', retryable: false }],
    [{ status: 200 }, { code: 'unknown', retryable: true }],
  ])('%j → %j', (input, expected) => {
    expect(classifyRemoteError(input)).toEqual(expected);
  });

  it('recognises dead letters', () => {
    expect(isDeadLetter('permanent:23503')).toBe(true);
    expect(isDeadLetter('503')).toBe(false);
    expect(isDeadLetter(undefined)).toBe(false);
  });
});

describe('createSupabaseRemoteStore', () => {
  it('upserts by id and selects id + updated_at + deleted_at (a kept tombstone is visible)', async () => {
    const f = fakeClient([{ data: [{ id: 'a', updated_at: 't', deleted_at: null }], error: null, status: 201 }]);
    const store = createSupabaseRemoteStore(f.client);
    expect(await store.upsert('programs', [{ id: 'a' }])).toEqual({ ok: true, rows: [{ id: 'a', updated_at: 't', deleted_at: null }] });
    expect(f.calls).toEqual([['from', 'programs'], ['upsert', [{ id: 'a' }], { onConflict: 'id' }], ['select', 'id, updated_at, deleted_at']]);
    expect(await store.upsert('programs', [])).toEqual({ ok: true, rows: [] });
  });

  it('maps upsert errors and thrown fetch failures to typed errors', async () => {
    const f = fakeClient([{ data: null, error: { code: '23503' }, status: 409 }, new TypeError('Failed to fetch'), { data: null, error: { code: '' }, status: 0 }]);
    const store = createSupabaseRemoteStore(f.client);
    expect(await store.upsert('programs', [{ id: 'a' }])).toEqual({ ok: false, error: { code: '23503', retryable: false } });
    expect(await store.upsert('programs', [{ id: 'a' }])).toEqual({ ok: false, error: { code: 'network', retryable: true } });
    expect(await store.upsert('programs', [{ id: 'a' }])).toEqual({ ok: false, error: { code: 'network', retryable: true } });
  });

  it('pulls everything, then from `since`, then by keyset, always ordered (updated_at, id)', async () => {
    const ok = { data: [{ id: 'x' }], error: null, status: 200 };
    const f = fakeClient([ok, ok, ok, { data: null, error: { code: 'PGRST301' }, status: 401 }, new Error('boom')]);
    const store = createSupabaseRemoteStore(f.client);
    await store.pull('arsenal', null, null, 500);
    await store.pull('arsenal', '2026-01-01T00:00:00.000Z', null, 500);
    await store.pull('arsenal', '2026-01-01T00:00:00.123456+00:00', 'id-9', 2);
    const tail = [['order', 'updated_at', { ascending: true }], ['order', 'id', { ascending: true }]];
    expect(f.calls.slice(0, 5)).toEqual([['from', 'arsenal'], ['select', '*'], ...tail, ['limit', 500]]);
    expect(f.calls[7]).toEqual(['gte', 'updated_at', '2026-01-01T00:00:00.000Z']);
    expect(f.calls[13]).toEqual(['or', 'updated_at.gt."2026-01-01T00:00:00.123456+00:00",and(updated_at.eq."2026-01-01T00:00:00.123456+00:00",id.gt."id-9")']);
    expect(f.calls.at(-1)).toEqual(['limit', 2]);
    expect(await store.pull('arsenal', null, null, 1)).toEqual({ ok: false, error: { code: 'auth_required', retryable: false, authRequired: true } });
    expect(await store.pull('arsenal', null, null, 1)).toEqual({ ok: false, error: { code: 'network', retryable: true } });
  });

  it('reads the account from the session and forwards auth events', async () => {
    const f = fakeClient([]);
    const store = createSupabaseRemoteStore(f.client);
    expect(await store.currentAccountId()).toBe('acc-1');
    f.auth.getSession.mockResolvedValueOnce({ data: { session: null } } as never);
    expect(await store.currentAccountId()).toBeNull();
    const cb = vi.fn();
    const stop = store.onAuthChange(cb);
    f.emit('SIGNED_IN', 'acc-2');
    f.emit('SIGNED_OUT', null);
    expect(cb.mock.calls).toEqual([['SIGNED_IN', 'acc-2'], ['SIGNED_OUT', null]]);
    stop();
    expect(f.unsubscribe).toHaveBeenCalledTimes(1);
  });
});

describe('createSupabaseRemoteStore.undelete', () => {
  it('calls public.undelete_row and reports whether a tombstone was cleared', async () => {
    const f = fakeClient([
      { data: true, error: null, status: 200 },
      { data: false, error: null, status: 200 },
      { data: null, error: { code: '22023' }, status: 400 },
      new Error('offline'),
    ]);
    const store = createSupabaseRemoteStore(f.client);
    expect(await store.undelete('arsenal', 'id-1')).toEqual({ ok: true, restored: true });
    expect(await store.undelete('arsenal', 'id-2')).toEqual({ ok: true, restored: false });
    expect(await store.undelete('nope', 'id-3')).toEqual({ ok: false, error: { code: '22023', retryable: false } });
    expect(await store.undelete('arsenal', 'id-4')).toEqual({ ok: false, error: { code: 'network', retryable: true } });
    expect(f.calls[0]).toEqual(['rpc', 'undelete_row', { p_table: 'arsenal', p_id: 'id-1' }]);
  });
});

describe('createLazyRemoteStore', () => {
  function inner(): RemoteStore {
    return {
      upsert: vi.fn(async () => ({ ok: true as const, rows: [] })),
      pull: vi.fn(async () => ({ ok: true as const, rows: [] })),
      undelete: vi.fn(async () => ({ ok: true as const, restored: false })),
      currentAccountId: vi.fn(async () => 'acc'),
      onAuthChange: vi.fn(() => vi.fn()),
    };
  }

  it('loads once on first use and delegates', async () => {
    const real = inner();
    const load = vi.fn(async () => real);
    const lazy = createLazyRemoteStore(load);
    expect(load).not.toHaveBeenCalled();
    expect(await lazy.currentAccountId()).toBe('acc');
    await lazy.upsert('t', []);
    await lazy.pull('t', null, null, 1);
    expect(load).toHaveBeenCalledTimes(1);
    expect(real.pull).toHaveBeenCalledWith('t', null, null, 1);
    const stop = lazy.onAuthChange(vi.fn());
    await Promise.resolve();
    await Promise.resolve();
    stop();
    expect(real.onAuthChange).toHaveBeenCalledTimes(1);
  });

  it('turns a failed load into a retryable network error and retries the load later', async () => {
    const real = inner();
    const load = vi.fn().mockRejectedValueOnce(new Error('chunk load')).mockResolvedValue(real);
    const lazy = createLazyRemoteStore(load);
    expect(await lazy.upsert('t', [])).toEqual({ ok: false, error: { code: 'network', retryable: true } });
    expect(await lazy.pull('t', null, null, 1)).toEqual({ ok: true, rows: [] });
    const failing = createLazyRemoteStore(() => Promise.reject(new Error('x')));
    expect(await failing.pull('t', null, null, 1)).toEqual({ ok: false, error: { code: 'network', retryable: true } });
    const stop = failing.onAuthChange(vi.fn());
    stop();
    await expect(failing.currentAccountId()).rejects.toThrow('x');
  });
});
