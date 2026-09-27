import 'fake-indexeddb/auto';
import { StrictMode } from 'react';
import { render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// Flag on before any module loads (the providers install at module init).
const fake = vi.hoisted(() => {
  process.env.NEXT_PUBLIC_SYNC_ENABLED = 'true';
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:54421';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon';
  const state = { clients: 0, unsubscribed: 0, from: 0 };
  const client = {
    auth: {
      getSession: async () => ({ data: { session: null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => void (state.unsubscribed += 1) } } }),
      signOut: async () => ({}),
    },
    from: () => {
      state.from += 1;
      throw new Error('signed out: no table access expected');
    },
  };
  return { state, client };
});
vi.mock('@supabase/ssr', () => ({
  createBrowserClient: () => {
    fake.state.clients += 1;
    return fake.client;
  },
  createServerClient: () => {
    throw new Error('no server client in the browser');
  },
}));

import { getRepository } from '@/lib/db';
import { getInstalledSyncAdapter } from '@/lib/sync';
import { Providers } from '../index';

describe('Providers with NEXT_PUBLIC_SYNC_ENABLED=true', () => {
  it('installs the adapter before the first write, runs a first sync, stops triggers on unmount', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const removed: string[] = [];
    const remove = window.removeEventListener.bind(window);
    vi.spyOn(window, 'removeEventListener').mockImplementation((type, fn, opts) => {
      removed.push(type);
      remove(type, fn, opts);
    });

    // Installed at module init, before anything rendered.
    const adapter = getInstalledSyncAdapter();
    expect(adapter.enabled).toBe(true);

    const { unmount } = render(
      <StrictMode>
        <Providers>
          <p>app</p>
        </Providers>
      </StrictMode>,
    );
    await waitFor(() => expect(window.__tytaxE2E?.ready).toBe(true));

    // AppBootstrap's first write (the first-run profile) queued its op: the
    // adapter was already installed when it ran.
    const repo = getRepository();
    const profiles = await repo.profiles.list();
    expect(profiles).toHaveLength(1);
    expect(await repo.outbox.count()).toBeGreaterThanOrEqual(1);

    // The first sync ran (signed out: auth_required, outbox kept, no REST call).
    await waitFor(() => expect(adapter.getState().lastError).toBe('auth_required'));
    expect(adapter.getState().status).toBe('error');
    expect(fake.state.clients).toBe(1);
    expect(fake.state.from).toBe(0);
    expect(fetchSpy).not.toHaveBeenCalled();

    unmount();
    expect(removed).toEqual(expect.arrayContaining(['online', 'offline']));
    await waitFor(() => expect(fake.state.unsubscribed).toBeGreaterThanOrEqual(1));
    vi.unstubAllGlobals();
  });
});
