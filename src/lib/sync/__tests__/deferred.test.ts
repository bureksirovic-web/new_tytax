import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { noopSyncAdapter, type SyncAdapter, type SyncState } from '@/contracts/sync';
import { getRepository } from '@/lib/db';
import { createDeferredSyncAdapter } from '../deferred';
import { getDeferredSyncAdapter, getInstalledSyncAdapter, installSyncAdapter, isSyncEnabled, resetInstalledSyncAdapterForTests } from '../install';

function fakeReal() {
  let state: SyncState = { status: 'idle', lastSyncedAt: '2026-09-01T00:00:00.000Z', pending: 3 };
  const listeners = new Set<(s: SyncState) => void>();
  const real: SyncAdapter & { set(s: SyncState): void } = {
    enabled: true,
    notifyChanged: vi.fn(),
    syncNow: vi.fn(async () => ({ pushed: 1, pulled: 0, failed: 0, state })),
    getState: () => state,
    subscribe: (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    set(s) {
      state = s;
      listeners.forEach((l) => l(s));
    },
  };
  return real;
}

describe('createDeferredSyncAdapter', () => {
  it('is enabled at once; notifyChanged before the load is replayed once the real adapter arrives', async () => {
    const real = fakeReal();
    const loadReal = vi.fn(async () => real);
    const deferred = createDeferredSyncAdapter(loadReal);
    expect(deferred.enabled).toBe(true);
    expect(deferred.getState()).toEqual({ status: 'idle', lastSyncedAt: null, pending: 0 });

    deferred.notifyChanged();
    deferred.notifyChanged();
    await deferred.load();
    expect(loadReal).toHaveBeenCalledTimes(1);
    expect(real.notifyChanged).toHaveBeenCalledTimes(1);
    expect(deferred.getState().pending).toBe(3);

    deferred.notifyChanged();
    expect(real.notifyChanged).toHaveBeenCalledTimes(2);
  });

  it('forwards state changes to its own listeners; a throwing listener does not break others', async () => {
    const real = fakeReal();
    const deferred = createDeferredSyncAdapter(async () => real);
    const seen: string[] = [];
    deferred.subscribe(() => {
      throw new Error('bad listener');
    });
    const off = deferred.subscribe((s) => seen.push(s.status));
    await deferred.load();
    real.set({ status: 'syncing', lastSyncedAt: null, pending: 3 });
    off();
    real.set({ status: 'idle', lastSyncedAt: null, pending: 0 });
    expect(seen).toEqual(['idle', 'syncing']);
    expect(deferred.getState().pending).toBe(0);
  });

  it('syncNow waits for the load; a failed load reports network and the next call retries', async () => {
    const real = fakeReal();
    let fail = true;
    const loadReal = vi.fn(async () => {
      if (fail) throw new Error('chunk load failed');
      return real;
    });
    const deferred = createDeferredSyncAdapter(loadReal);
    const failed = await deferred.syncNow();
    expect(failed.state).toMatchObject({ status: 'error', lastError: 'network' });
    deferred.notifyChanged(); // swallowed load failure, no unhandled rejection
    await Promise.resolve();

    fail = false;
    const ok = await deferred.syncNow();
    expect(ok.pushed).toBe(1);
    expect(real.syncNow).toHaveBeenCalledTimes(1);
    expect(loadReal).toHaveBeenCalledTimes(3);
  });
});

describe('installSyncAdapter', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    resetInstalledSyncAdapterForTests();
  });

  it('flag off → installs nothing; the repository queues nothing', async () => {
    vi.stubEnv('NEXT_PUBLIC_SYNC_ENABLED', 'false');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://127.0.0.1:54421');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon');
    expect(isSyncEnabled()).toBe(false);
    expect(installSyncAdapter()).toBe(noopSyncAdapter);
    expect(getDeferredSyncAdapter()).toBeNull();
    const repo = getRepository();
    const p = await repo.profiles.create({ name: 'Off' });
    await repo.bodyweight.add(p.id, { date: '2026-09-26', valueKg: 70 });
    expect(await repo.outbox.count()).toBe(0);
  });

  it('flag on → one deferred adapter, idempotent; the repository queues from the next write', async () => {
    vi.stubEnv('NEXT_PUBLIC_SYNC_ENABLED', 'true');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://127.0.0.1:54421');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon');
    const first = installSyncAdapter();
    expect(first.enabled).toBe(true);
    expect(installSyncAdapter()).toBe(first);
    expect(getInstalledSyncAdapter()).toBe(first);
    expect(getDeferredSyncAdapter()).toBe(first);
    const repo = getRepository();
    const before = await repo.outbox.count();
    const p = await repo.profiles.create({ name: 'On' });
    await repo.bodyweight.add(p.id, { date: '2026-09-26', valueKg: 71 });
    expect(await repo.outbox.count()).toBe(before + 2);
  });

  it('flag on without Supabase env → nothing installed', () => {
    vi.stubEnv('NEXT_PUBLIC_SYNC_ENABLED', 'true');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '');
    expect(installSyncAdapter()).toBe(noopSyncAdapter);
    expect(getInstalledSyncAdapter()).toBe(noopSyncAdapter);
    expect(getDeferredSyncAdapter()).toBeNull();
  });
});
