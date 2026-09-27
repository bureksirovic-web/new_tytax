import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { noopSyncAdapter } from '@/contracts/sync';
import { TytaxDatabase, createRepository } from '@/lib/db';
import { asSupabaseSyncAdapter, getSyncAdapter, isSyncEnabled, resetSyncAdapterForTests } from '../index';
import { T0, draftFor } from './harness';

const supabase = vi.hoisted(() => ({
  createBrowserClient: vi.fn(() => ({
    auth: {
      getSession: async () => ({ data: { session: null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
    from: () => {
      throw new Error('no table access expected');
    },
  })),
  createServerClient: vi.fn(),
  createClient: vi.fn(),
}));

vi.mock('@supabase/ssr', () => ({ createBrowserClient: supabase.createBrowserClient, createServerClient: supabase.createServerClient }));
vi.mock('@supabase/supabase-js', () => ({ createClient: supabase.createClient }));

const zeroSupabaseCalls = () => {
  expect(supabase.createBrowserClient).not.toHaveBeenCalled();
  expect(supabase.createServerClient).not.toHaveBeenCalled();
  expect(supabase.createClient).not.toHaveBeenCalled();
};

describe('getSyncAdapter', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    resetSyncAdapterForTests();
    fetchSpy = vi.fn(async () => new Response('{}'));
    vi.stubGlobal('fetch', fetchSpy);
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://127.0.0.1:54421');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'test-anon-key');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    resetSyncAdapterForTests();
  });

  it('flag off → noopSyncAdapter; mutations and syncNow make zero network or supabase calls', async () => {
    vi.stubEnv('NEXT_PUBLIC_SYNC_ENABLED', 'false');
    const adapter = getSyncAdapter();
    expect(adapter).toBe(noopSyncAdapter);
    expect(isSyncEnabled()).toBe(false);
    expect(asSupabaseSyncAdapter(adapter)).toBeNull();

    const repo = createRepository({ db: new TytaxDatabase(`idx-${Math.random()}`), sync: adapter });
    const profile = await repo.profiles.create({ name: 'Ana' });
    await repo.finishWorkout(draftFor(profile.id, T0, [[60, 8]]));
    await repo.bodyweight.add(profile.id, { date: '2026-03-02', valueKg: 70 });
    const res = await adapter.syncNow();

    expect(res.state.status).toBe('disabled');
    expect(await repo.outbox.count()).toBe(0);
    expect(fetchSpy).not.toHaveBeenCalled();
    zeroSupabaseCalls();
  });

  it('flag on without Supabase env → noopSyncAdapter, no calls', async () => {
    vi.stubEnv('NEXT_PUBLIC_SYNC_ENABLED', 'true');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', '');
    const adapter = getSyncAdapter();
    expect(adapter).toBe(noopSyncAdapter);
    await adapter.syncNow();
    expect(fetchSpy).not.toHaveBeenCalled();
    zeroSupabaseCalls();
  });

  it('flag on → one cached enabled adapter that loads the Supabase client only when it first syncs', async () => {
    vi.stubEnv('NEXT_PUBLIC_SYNC_ENABLED', 'true');
    const adapter = getSyncAdapter();
    expect(adapter.enabled).toBe(true);
    expect(getSyncAdapter()).toBe(adapter);
    expect(isSyncEnabled()).toBe(true);
    expect(asSupabaseSyncAdapter(adapter)).toBe(adapter);
    zeroSupabaseCalls();

    const res = await adapter.syncNow();

    expect(supabase.createBrowserClient).toHaveBeenCalledTimes(1);
    expect(res.state).toMatchObject({ status: 'error', lastError: 'auth_required' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
