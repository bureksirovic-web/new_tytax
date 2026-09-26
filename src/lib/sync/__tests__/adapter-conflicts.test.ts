/**
 * Conflict and recovery cases from the 2026-09-26 refuter run (each test was
 * red before its fix): device clock skew, the pull/local-edit race, sticky
 * tombstones after an undo, the first-push snapshot after a lost cursor store,
 * backlogs over one peek window and ops of another account.
 */
import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { noopSyncAdapter } from '@/contracts/sync';
import { createRepository } from '@/lib/db';
import { LAST_SYNCED_KEY } from '../cursors';
import { FakeRemoteStore } from './fake-remote';
import { ACCOUNT_A, ACCOUNT_B, T0, draftFor, makeDevice, uuid, type Device } from './harness';

const HOUR = 3_600_000;

afterEach(() => {
  vi.restoreAllMocks();
});

async function valueOf(d: Device, id: string): Promise<number | undefined> {
  return (await d.db.bodyweightEntries.get(id))?.valueKg;
}

async function seeded(opts: { bStart?: Date } = {}) {
  const remote = new FakeRemoteStore({ account: ACCOUNT_A });
  const a = makeDevice(remote);
  const b = makeDevice(remote, opts.bStart ? { start: opts.bStart } : {});
  const profile = await a.repo.profiles.create({ name: 'Ana' });
  const bw = await a.repo.bodyweight.add(profile.id, { date: '2026-03-02', valueKg: 80 });
  await a.adapter.syncNow();
  await b.adapter.syncNow();
  return { remote, a, b, profileId: profile.id, bwId: bw.id };
}

describe('clock skew (server updated_at vs device clock)', () => {
  it('a device whose clock runs 1 h ahead still takes newer remote edits and never pushes a stale row back', async () => {
    const { remote, a, b, profileId, bwId } = await seeded({ bStart: new Date(T0.getTime() + HOUR) });
    await b.repo.bodyweight.update(profileId, bwId, { valueKg: 81 });
    await b.adapter.syncNow();
    await a.adapter.syncNow();
    expect(await valueOf(a, bwId)).toBe(81);

    await a.repo.bodyweight.update(profileId, bwId, { valueKg: 82 });
    await a.adapter.syncNow();
    const bRun = await b.adapter.syncNow();
    expect(bRun.pulled).toBe(1);
    expect(await valueOf(b, bwId)).toBe(82);

    // B then changes only the date and pushes the whole row: 82 must survive.
    await b.repo.bodyweight.update(profileId, bwId, { date: '2026-03-03' });
    await b.adapter.syncNow();
    await a.adapter.syncNow();
    expect(remote.row('bodyweight_entries', bwId)?.value_kg).toBe(82);
    expect(await a.db.bodyweightEntries.get(bwId)).toMatchObject({ valueKg: 82, date: '2026-03-03' });
  });

  it('a local edit that lands while a page is being applied survives on a device whose clock is behind', async () => {
    const { remote, a, b, profileId, bwId } = await seeded({ bStart: new Date(T0.getTime() - HOUR) });
    await a.repo.bodyweight.update(profileId, bwId, { valueKg: 85 });
    await a.adapter.syncNow();

    // The user's edit starts right after the pending check read the outbox
    // (its own transaction, as a real edit from the UI would be).
    let armed = false;
    let edit: Promise<unknown> | null = null;
    const pull = remote.pull.bind(remote);
    vi.spyOn(remote, 'pull').mockImplementation(async (table, since, afterId, limit) => {
      if (table === 'bodyweight_entries') armed = true;
      return pull(table, since, afterId, limit);
    });
    const userEdit = () => {
      if (armed && !edit) edit = Dexie.ignoreTransaction(() => b.repo.bodyweight.update(profileId, bwId, { valueKg: 99 }));
    };
    const peek = b.repo.outbox.peek.bind(b.repo.outbox);
    const count = b.repo.outbox.count.bind(b.repo.outbox);
    vi.spyOn(b.repo.outbox, 'peek').mockImplementation(async (limit) => {
      const ops = await peek(limit);
      userEdit();
      return ops;
    });
    vi.spyOn(b.repo.outbox, 'count').mockImplementation(async () => {
      const n = await count();
      userEdit();
      return n;
    });

    await b.adapter.syncNow();
    await edit;
    expect(edit).not.toBeNull();
    expect(await valueOf(b, bwId)).toBe(99);
    expect(await b.repo.outbox.count()).toBe(1);

    vi.restoreAllMocks();
    await b.adapter.syncNow();
    await a.adapter.syncNow();
    expect(remote.row('bodyweight_entries', bwId)?.value_kg).toBe(99);
    expect(await valueOf(a, bwId)).toBe(99);
  });

  it('a record whose queued op sits beyond the first 200 ops is still protected from the pull', async () => {
    const { remote, a, b, profileId, bwId } = await seeded();
    await a.repo.bodyweight.update(profileId, bwId, { valueKg: 85 });
    await a.adapter.syncNow();

    let done = false;
    const pull = remote.pull.bind(remote);
    vi.spyOn(remote, 'pull').mockImplementation(async (table, since, afterId, limit) => {
      if (table === 'family_members' && !done) {
        done = true;
        await b.repo.transaction(async () => {
          for (let i = 0; i < 250; i++) await b.repo.bodyweight.add(profileId, { date: '2026-03-04', valueKg: 60 });
        });
        await b.repo.bodyweight.update(profileId, bwId, { valueKg: 99 });
      }
      return pull(table, since, afterId, limit);
    });

    await b.adapter.syncNow();
    expect(done).toBe(true);
    expect(await valueOf(b, bwId)).toBe(99);
    expect(await b.repo.outbox.count()).toBe(251);
  });
});

describe('tombstones', () => {
  it('undo delete, re-adding to the arsenal and rewriting a cleared note reach the server and every device', async () => {
    const remote = new FakeRemoteStore({ account: ACCOUNT_A });
    const a = makeDevice(remote);
    const b = makeDevice(remote);
    const p = (await a.repo.profiles.create({ name: 'Ana' })).id;
    const entry = await a.repo.arsenal.add(p, 'bench');
    const note = await a.repo.notes.set(p, 'bench', 'first note');
    const { log } = await a.repo.finishWorkout(draftFor(p, T0, [[60, 8]]));
    await a.adapter.syncNow();

    await a.repo.arsenal.remove(p, 'bench');
    await a.repo.notes.set(p, 'bench', '');
    await a.repo.logs.softDelete(p, log.id);
    await a.adapter.syncNow();
    expect(remote.row('workout_logs', log.id)?.deleted_at).toEqual(expect.any(String));

    await a.repo.arsenal.add(p, 'bench');
    await a.repo.notes.set(p, 'bench', 'second note');
    await a.repo.logs.restore(p, log.id);
    const run = await a.adapter.syncNow();
    expect(run.failed).toBe(0);
    expect(run.state.status).toBe('idle');
    for (const [table, id] of [['arsenal', entry.id], ['exercise_notes', note?.id], ['workout_logs', log.id]] as const) {
      expect({ table, deleted_at: remote.row(table, String(id))?.deleted_at ?? null }).toEqual({ table, deleted_at: null });
    }

    await b.adapter.syncNow();
    for (const d of [a, b]) {
      expect(await d.repo.arsenal.has(p, 'bench')).toBe(true);
      expect((await d.repo.notes.get(p, 'bench'))?.content).toBe('second note');
      expect(await d.repo.logs.get(p, log.id)).toBeDefined();
    }
  });

  it('a delete op for a record that is still live locally is sent as a tombstone (op.createdAt)', async () => {
    const remote = new FakeRemoteStore({ account: ACCOUNT_A });
    const d = makeDevice(remote);
    const offline = createRepository({ db: d.db, sync: noopSyncAdapter, newId: uuid, now: d.now });
    const profile = await offline.profiles.create({ name: 'Ana', accountId: ACCOUNT_A });
    const bw = await offline.bodyweight.add(profile.id, { date: '2026-03-02', valueKg: 70 });
    await d.adapter.syncNow();
    expect(remote.row('bodyweight_entries', bw.id)?.deleted_at ?? null).toBeNull();

    const createdAt = '2026-03-02T13:00:00.000Z';
    await d.db.syncQueue.add({ id: uuid(), table: 'bodyweight_entries', op: 'delete', recordId: bw.id, profileId: profile.id, createdAt, retryCount: 0 });
    const run = await d.adapter.syncNow();

    expect(run.pushed).toBe(1);
    expect(remote.row('bodyweight_entries', bw.id)?.deleted_at).toBe(createdAt);
    expect(await d.repo.outbox.count()).toBe(0);
  });
});

describe('first-push snapshot', () => {
  it('after the cursor store is lost, the snapshot never overwrites a newer server row with the stale local copy', async () => {
    const { remote, a, b, profileId, bwId } = await seeded();
    await a.repo.bodyweight.update(profileId, bwId, { valueKg: 90 });
    await a.adapter.syncNow();

    // Same IndexedDB, empty localStorage (quota fallback, cleared storage).
    const b2 = makeDevice(remote, { db: b.db });
    const run = await b2.adapter.syncNow();
    await a.adapter.syncNow();

    expect(run.pushed).toBe(0);
    expect(remote.row('bodyweight_entries', bwId)?.value_kg).toBe(90);
    expect(await valueOf(a, bwId)).toBe(90);
    expect(await valueOf(b2, bwId)).toBe(90);
  });

  it('still pushes local records the server does not have', async () => {
    const { remote, b, profileId } = await seeded();
    const offline = createRepository({ db: b.db, sync: noopSyncAdapter, newId: uuid, now: b.now });
    const extra = await offline.bodyweight.add(profileId, { date: '2026-03-05', valueKg: 77 });

    const b2 = makeDevice(remote, { db: b.db });
    const run = await b2.adapter.syncNow();

    expect(run.pushed).toBe(1);
    expect(remote.row('bodyweight_entries', extra.id)?.value_kg).toBe(77);
    expect(remote.rows('bodyweight_entries')).toHaveLength(2);
  });
});

describe('run completeness', () => {
  it('drains a backlog larger than one peek window in a single run', async () => {
    const remote = new FakeRemoteStore({ account: ACCOUNT_A });
    const d = makeDevice(remote);
    const p = (await d.repo.profiles.create({ name: 'Ana' })).id;
    await d.repo.transaction(async () => {
      for (let i = 0; i < 450; i++) await d.repo.bodyweight.add(p, { date: '2026-03-02', valueKg: 60 + (i % 40) });
    });

    const run = await d.adapter.syncNow();

    expect(run.pushed).toBe(451);
    expect(run.state).toMatchObject({ status: 'idle', pending: 0 });
    expect(remote.rows('bodyweight_entries')).toHaveLength(450);
    expect(await d.repo.outbox.count()).toBe(0);
  });

  it('ops of another account keep the state honest: error other_account, no lastSyncedAt', async () => {
    const remote = new FakeRemoteStore({ account: ACCOUNT_A });
    const d = makeDevice(remote);
    const mine = await d.repo.profiles.create({ name: 'Ana' });
    await d.repo.bodyweight.add(mine.id, { date: '2026-03-02', valueKg: 70 });
    // A profile imported from account B's backup (its accountId travels in the file).
    const theirs = await d.repo.profiles.create({ name: 'Bo', accountId: ACCOUNT_B });
    await d.repo.bodyweight.add(theirs.id, { date: '2026-03-02', valueKg: 90 });

    const run = await d.adapter.syncNow();

    expect(run.pushed).toBe(2);
    expect(run.state).toMatchObject({ status: 'error', lastError: 'other_account', lastSyncedAt: null, pending: 2 });
    expect(d.storage.getItem(LAST_SYNCED_KEY)).toBeNull();
    expect(remote.rows('family_members').map((r) => r.id)).toEqual([mine.id]);
  });
});
