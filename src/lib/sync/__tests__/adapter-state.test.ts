import 'fake-indexeddb/auto';
import { describe, expect, it, vi } from 'vitest';
import type { SyncAdapter, SyncState } from '@/contracts/sync';
import { BACKOFF_CAP_MS, DEBOUNCE_MS, backoffDelay, createSupabaseSyncAdapter } from '../adapter';
import { startAutoSync } from '../auto-sync';
import { LAST_SYNCED_KEY } from '../cursors';
import { FakeRemoteStore } from './fake-remote';
import { ACCOUNT_A, MemoryStorage, makeDevice } from './harness';

const NETWORK = { code: 'network', retryable: true } as const;

describe('backoff', () => {
  it('doubles from 2 s, caps at 5 min and adds up to 10 % jitter', () => {
    expect([0, 1, 2, 3].map((n) => backoffDelay(n, () => 0))).toEqual([2000, 4000, 8000, 16000]);
    expect(backoffDelay(20, () => 0)).toBe(BACKOFF_CAP_MS);
    expect(backoffDelay(0, () => 0.5)).toBe(2100);
    expect(backoffDelay(30, () => 0.999)).toBeLessThan(BACKOFF_CAP_MS * 1.1);
  });

  it('schedules retries 2 s, 4 s, 8 s on repeated retryable failures and resets after success', async () => {
    const remote = new FakeRemoteStore({ account: ACCOUNT_A });
    const d = makeDevice(remote);
    await d.repo.profiles.create({ name: 'Ana' });
    remote.failNext('upsert', NETWORK, { times: 3 });
    const retries = () => d.timers.delays.filter((ms) => ms !== DEBOUNCE_MS);

    await d.adapter.syncNow();
    for (let i = 0; i < 3; i++) {
      d.timers.fire(retries().at(-1));
      await d.adapter.syncNow();
    }
    expect(retries()).toEqual([2000, 4000, 8000]);
    expect(d.adapter.getState().status).toBe('idle');

    remote.failNext('upsert', NETWORK);
    await d.repo.profiles.create({ name: 'Bo' });
    await d.adapter.syncNow();
    expect(retries().at(-1)).toBe(2000);
  });
});

describe('adapter state', () => {
  it('is single-flight: concurrent syncNow calls share one run', async () => {
    const remote = new FakeRemoteStore({ account: ACCOUNT_A });
    const d = makeDevice(remote);
    await d.repo.profiles.create({ name: 'Ana' });
    const who = vi.spyOn(remote, 'currentAccountId');

    const [x, y] = [d.adapter.syncNow(), d.adapter.syncNow()];
    expect(x).toBe(y);
    await Promise.all([x, y]);
    expect(who).toHaveBeenCalledTimes(1);
    await d.adapter.syncNow();
    expect(who).toHaveBeenCalledTimes(2);
  });

  it('notifyChanged only debounces a background run (1.5 s) and re-runs after an in-flight one', async () => {
    const remote = new FakeRemoteStore({ account: ACCOUNT_A });
    const d = makeDevice(remote);
    const run = vi.spyOn(d.adapter, 'syncNow');
    await d.repo.profiles.create({ name: 'Ana' });
    await d.repo.profiles.create({ name: 'Bo' });
    expect(d.timers.pending.map((t) => t.ms)).toEqual([DEBOUNCE_MS]);
    expect(run).not.toHaveBeenCalled();

    const inflight = d.adapter.syncNow();
    d.timers.fire(DEBOUNCE_MS);
    await inflight;
    expect(d.timers.pending.map((t) => t.ms)).toEqual([DEBOUNCE_MS]);
    d.timers.fire(DEBOUNCE_MS);
    expect(run).toHaveBeenCalledTimes(2);
    await d.adapter.syncNow();
    expect(await d.repo.outbox.count()).toBe(0);
  });

  it('reports offline without touching the network, and markOffline sets offline', async () => {
    const remote = new FakeRemoteStore({ account: ACCOUNT_A });
    const d = makeDevice(remote);
    await d.repo.profiles.create({ name: 'Ana' });
    d.online = false;
    const res = await d.adapter.syncNow();
    expect(res.state).toMatchObject({ status: 'offline', pending: 1 });
    expect(remote.calls).toHaveLength(0);

    d.online = true;
    await d.adapter.syncNow();
    d.adapter.markOffline();
    expect(d.adapter.getState().status).toBe('offline');
  });

  it('a network failure while the browser is offline does not schedule a retry', async () => {
    const remote = new FakeRemoteStore({ account: ACCOUNT_A });
    const d = makeDevice(remote);
    await d.repo.profiles.create({ name: 'Ana' });
    vi.spyOn(remote, 'upsert').mockImplementation(async () => {
      d.online = false;
      return { ok: false, error: NETWORK };
    });
    const res = await d.adapter.syncNow();
    expect(res.state).toMatchObject({ status: 'offline', lastError: 'network' });
    expect(d.timers.pending.filter((t) => t.ms !== DEBOUNCE_MS)).toHaveLength(0);
  });

  it('persists lastSyncedAt only after a fully successful run and notifies subscribers', async () => {
    const remote = new FakeRemoteStore({ account: ACCOUNT_A });
    const d = makeDevice(remote);
    const seen: SyncState[] = [];
    const unsubscribe = d.adapter.subscribe((s) => seen.push(s));
    d.adapter.subscribe(() => {
      throw new Error('bad listener');
    });
    await d.repo.profiles.create({ name: 'Ana' });
    remote.failNext('pull', NETWORK);
    await d.adapter.syncNow();
    expect(d.storage.getItem(LAST_SYNCED_KEY)).toBeNull();

    const res = await d.adapter.syncNow();
    expect(res.state.lastSyncedAt).toBe(d.now().toISOString());
    expect(d.storage.getItem(LAST_SYNCED_KEY)).toBe(res.state.lastSyncedAt);
    expect(seen.map((s) => s.status)).toEqual(expect.arrayContaining(['syncing', 'error', 'idle']));
    expect(res.state.lastError).toBeUndefined();

    unsubscribe();
    const n = seen.length;
    await d.adapter.syncNow();
    expect(seen).toHaveLength(n);
    const reloaded = createSupabaseSyncAdapter({ repo: d.repo, remote, storage: d.storage });
    expect(reloaded.getState().lastSyncedAt).toBe(res.state.lastSyncedAt);
  });

  it('never throws: account lookup or repository failures land in the state', async () => {
    const remote = new FakeRemoteStore({ account: ACCOUNT_A });
    const d = makeDevice(remote);
    vi.spyOn(remote, 'currentAccountId').mockRejectedValueOnce(new Error('offline'));
    expect((await d.adapter.syncNow()).state).toMatchObject({ status: 'error', lastError: 'network' });

    vi.spyOn(d.repo.profiles, 'list').mockRejectedValueOnce(new Error('idb closed'));
    const res = await d.adapter.syncNow();
    expect(res.state).toMatchObject({ status: 'error', lastError: 'internal' });
    d.adapter.dispose();
    expect(d.timers.pending).toHaveLength(0);
  });
});

describe('startAutoSync', () => {
  function target(visibilityState = 'visible') {
    return Object.assign(new EventTarget(), { visibilityState });
  }

  it('syncs on online, visible and SIGNED_IN/TOKEN_REFRESHED; marks offline; stop() removes everything', () => {
    const remote = new FakeRemoteStore({ account: ACCOUNT_A });
    const adapter = createSupabaseSyncAdapter({ repo: makeDevice(remote).repo, remote, storage: new MemoryStorage() });
    const syncNow = vi.spyOn(adapter, 'syncNow').mockResolvedValue({ pushed: 0, pulled: 0, failed: 0, state: adapter.getState() });
    const win = target();
    const doc = target('hidden');

    const stop = startAutoSync(adapter, { window: win, document: doc });
    win.dispatchEvent(new Event('online'));
    doc.dispatchEvent(new Event('visibilitychange'));
    doc.visibilityState = 'visible';
    doc.dispatchEvent(new Event('visibilitychange'));
    remote.signIn(ACCOUNT_A, 'SIGNED_IN');
    remote.signIn(ACCOUNT_A, 'TOKEN_REFRESHED');
    remote.signIn(null, 'SIGNED_OUT');
    expect(syncNow).toHaveBeenCalledTimes(4);
    win.dispatchEvent(new Event('offline'));
    expect(adapter.getState().status).toBe('offline');

    stop();
    win.dispatchEvent(new Event('online'));
    doc.dispatchEvent(new Event('visibilitychange'));
    remote.signIn(ACCOUNT_A, 'SIGNED_IN');
    expect(syncNow).toHaveBeenCalledTimes(4);
  });

  it('is inert for a disabled adapter and tolerates missing globals', () => {
    const disabled: SyncAdapter = { enabled: false, notifyChanged: vi.fn(), syncNow: vi.fn(), getState: vi.fn(), subscribe: vi.fn() };
    const stop = startAutoSync(disabled, { window: null, document: null, onAuthChange: null });
    stop();
    expect(disabled.syncNow).not.toHaveBeenCalled();
    const remote = new FakeRemoteStore({ account: ACCOUNT_A });
    const adapter = createSupabaseSyncAdapter({ repo: makeDevice(remote).repo, remote, storage: new MemoryStorage() });
    const stop2 = startAutoSync(adapter, { onAuthChange: null });
    expect(typeof stop2).toBe('function');
    stop2();
    expect(adapter.getState().status).toBe('idle');
  });
});
