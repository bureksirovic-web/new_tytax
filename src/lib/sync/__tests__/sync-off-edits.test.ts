/**
 * Refuter R1 (2026-09-27): an edit made while the sync adapter is disabled
 * (the build flag or the Supabase env turned off on a device that had synced)
 * queued no op, so the first pull after sync came back made the server copy
 * win and the edit was lost. Ops are now queued for any profile an account
 * has claimed, whatever the adapter; never-synced profiles still queue nothing.
 */
import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { noopSyncAdapter } from '@/contracts/sync';
import { createRepository } from '@/lib/db/repository';
import { FakeRemoteStore } from './fake-remote';
import { ACCOUNT_A, T0, draftFor, makeDevice, uuid } from './harness';

describe('edits while sync is disabled', () => {
  it('an edit of a synced profile made with sync off is queued and survives the next sync', async () => {
    const remote = new FakeRemoteStore({ account: ACCOUNT_A, start: T0 });
    const a = makeDevice(remote);
    const p = await a.repo.profiles.create({ name: 'Ana' });
    const { log } = await a.repo.finishWorkout(draftFor(p.id, T0, [[100, 5]]));
    expect((await a.adapter.syncNow()).state.status).toBe('idle');
    expect(await a.repo.outbox.count()).toBe(0);

    // Same database, sync flag off (the app installs noopSyncAdapter).
    const off = createRepository({ db: a.db, sync: noopSyncAdapter, now: a.now, newId: uuid });
    a.tick();
    await off.logs.update(p.id, log.id, { notes: 'typed with sync off' });
    expect(await a.repo.outbox.count()).toBe(1);

    // Sync back on: the edit pushes instead of being overwritten by the pull.
    const res = await a.adapter.syncNow();
    expect(res.state.status).toBe('idle');
    expect(res.pushed).toBe(1);
    expect((await a.repo.logs.get(p.id, log.id))?.notes).toBe('typed with sync off');
    expect(remote.row('workout_logs', log.id)!.notes).toBe('typed with sync off');
    a.adapter.dispose();
  });

  it('a profile that never synced queues nothing while sync is off', async () => {
    const remote = new FakeRemoteStore({ account: ACCOUNT_A, start: T0 });
    const a = makeDevice(remote);
    const off = createRepository({ db: a.db, sync: noopSyncAdapter, now: a.now, newId: uuid });
    const p = await off.profiles.create({ name: 'Local only' });
    await off.finishWorkout(draftFor(p.id, T0, [[60, 8]]));
    await off.bodyweight.add(p.id, { date: '2026-03-02', valueKg: 80 });
    expect((await off.profiles.get(p.id))?.accountId).toBeUndefined();
    expect(await a.db.syncQueue.count()).toBe(0);
    a.adapter.dispose();
  });
});
