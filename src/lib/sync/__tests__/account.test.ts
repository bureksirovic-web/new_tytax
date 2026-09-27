import { afterEach, describe, expect, it, vi } from 'vitest';
import { DISABLED_ACCOUNT, createAccountStore, getAccountStore, resetAccountStoreForTests, type AuthClientLike } from '../account';

const clientModule = vi.hoisted(() => ({ loaded: 0 }));
vi.mock('@/lib/supabase/client', () => {
  clientModule.loaded += 1;
  return { createClient: () => fakeClient(null).client };
});

type AuthCb = (event: string, session: { user: { email: string } } | null) => void;

function fakeClient(email: string | null, opts: { getSessionThrows?: boolean; signOutThrows?: boolean } = {}) {
  const calls = { signOut: 0, unsubscribed: 0 };
  let cb: AuthCb = () => {};
  const client: AuthClientLike = {
    auth: {
      getSession: async () => {
        if (opts.getSessionThrows) throw new Error('boom');
        return { data: { session: email ? { user: { email } } : null } };
      },
      onAuthStateChange: (fn) => {
        cb = fn as AuthCb;
        return { data: { subscription: { unsubscribe: () => void (calls.unsubscribed += 1) } } };
      },
      signOut: async () => {
        calls.signOut += 1;
        if (opts.signOutThrows) throw new Error('offline');
        return {};
      },
    },
  };
  return { client, calls, emit: (event: string, e: string | null) => cb(event, e ? { user: { email: e } } : null) };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('createAccountStore', () => {
  it('starts loading, loads the client on first subscribe only, then reports the session email', async () => {
    const fake = fakeClient('ana@example.com');
    const load = vi.fn(async () => fake.client);
    const store = createAccountStore(load);
    expect(store.getState().status).toBe('loading');
    expect(load).not.toHaveBeenCalled();

    const listener = vi.fn();
    store.subscribe(listener);
    store.subscribe(() => {});
    await flush();
    expect(load).toHaveBeenCalledTimes(1);
    expect(store.getState()).toEqual({ status: 'signed_in', email: 'ana@example.com' });
    expect(listener).toHaveBeenCalled();
  });

  it('follows auth events and ignores no-op changes', async () => {
    const fake = fakeClient(null);
    const store = createAccountStore(async () => fake.client);
    const listener = vi.fn();
    store.subscribe(listener);
    await flush();
    expect(store.getState()).toEqual({ status: 'signed_out', email: null });

    fake.emit('SIGNED_IN', 'b@example.com');
    expect(store.getState()).toEqual({ status: 'signed_in', email: 'b@example.com' });
    const calls = listener.mock.calls.length;
    fake.emit('TOKEN_REFRESHED', 'b@example.com');
    expect(listener.mock.calls.length).toBe(calls);
    fake.emit('SIGNED_OUT', null);
    expect(store.getState().status).toBe('signed_out');
  });

  it('a failed load or getSession ends signed out, never throws', async () => {
    const failing = createAccountStore(async () => {
      throw new Error('chunk load failed');
    });
    failing.subscribe(() => {});
    await flush();
    expect(failing.getState().status).toBe('signed_out');
    await expect(failing.signOut()).resolves.toBeUndefined();

    const broken = createAccountStore(async () => fakeClient('x@example.com', { getSessionThrows: true }).client);
    broken.subscribe(() => {});
    await flush();
    expect(broken.getState().status).toBe('signed_out');
  });

  it('signOut calls supabase and ends signed out even when the revoke fails', async () => {
    const fake = fakeClient('c@example.com', { signOutThrows: true });
    const store = createAccountStore(async () => fake.client);
    store.subscribe(() => {});
    await flush();
    expect(store.getState().status).toBe('signed_in');
    await store.signOut();
    expect(fake.calls.signOut).toBe(1);
    expect(store.getState()).toEqual({ status: 'signed_out', email: null });
  });
});

describe('getAccountStore', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    resetAccountStoreForTests();
  });

  it('flag off → the disabled store; subscribing never loads the Supabase client', async () => {
    vi.stubEnv('NEXT_PUBLIC_SYNC_ENABLED', '');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://127.0.0.1:54421');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon');
    const store = getAccountStore();
    store.subscribe(() => {});
    await store.signOut();
    await flush();
    expect(store.getState()).toBe(DISABLED_ACCOUNT);
    expect(clientModule.loaded).toBe(0);
  });

  it('flag on with env → one cached store that loads the client lazily', async () => {
    vi.stubEnv('NEXT_PUBLIC_SYNC_ENABLED', 'true');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://127.0.0.1:54421');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon');
    const store = getAccountStore();
    expect(getAccountStore()).toBe(store);
    expect(store.getState().status).toBe('loading');
    store.subscribe(() => {});
    await vi.waitFor(() => expect(store.getState().status).toBe('signed_out'));
    expect(clientModule.loaded).toBe(1);
  });
});
