import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import type { SyncOperation, SyncOutbox } from '@/contracts/sync';
import { PERMANENT_PREFIX } from '../errors';
import { PEEK_LIMIT, collectOps } from '../outbox-ops';
import { FakeRemoteStore } from './fake-remote';
import { ACCOUNT_A, makeDevice } from './harness';

/** Oldest-first in-memory outbox (only `peek` is used by collectOps). */
function outboxOf(ops: SyncOperation[]): SyncOutbox {
  return {
    peek: async (limit) => ops.slice(0, limit),
    ack: async () => undefined,
    fail: async () => undefined,
    count: async () => ops.length,
  };
}

function op(i: number, extra: Partial<SyncOperation> = {}): SyncOperation {
  return {
    id: `op-${i}`,
    table: 'bodyweight_entries',
    op: 'upsert',
    recordId: `rec-${i}`,
    profileId: 'p-mine',
    createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, 0, i)).toISOString(),
    retryCount: 0,
    ...extra,
  };
}

describe('collectOps: a long run of dead letters or deferred ops never hides a live op', () => {
  it('finds the live op behind 6,401 dead letters', async () => {
    const ops = [...Array.from({ length: 6_401 }, (_, i) => op(i, { lastError: `${PERMANENT_PREFIX}invalid_row` })), op(99_999)];
    const { live, dead } = await collectOps(outboxOf(ops), () => true);
    expect(live.map((o) => o.id)).toEqual(['op-99999']);
    expect(dead).toHaveLength(6_401);
  });

  it("finds the live op behind 6,401 ops of another account's profile", async () => {
    const ops = [...Array.from({ length: 6_401 }, (_, i) => op(i, { profileId: 'p-theirs' })), op(99_999)];
    const { live, deferred } = await collectOps(outboxOf(ops), (o) => o.profileId === 'p-mine');
    expect(live.map((o) => o.id)).toEqual(['op-99999']);
    expect(deferred).toBe(6_401);
  });

  it('still returns at most PEEK_LIMIT live ops', async () => {
    const ops = Array.from({ length: PEEK_LIMIT * 3 }, (_, i) => op(i));
    expect((await collectOps(outboxOf(ops), () => true)).live).toHaveLength(PEEK_LIMIT);
  });
});

describe('adapter: a backlog larger than one run is drained without a new trigger', () => {
  it('schedules a follow-up run when the push-round budget ran out with ops still queued', async () => {
    const remote = new FakeRemoteStore({ account: ACCOUNT_A });
    const d = makeDevice(remote, { maxPushRounds: 1 });
    const profile = await d.repo.profiles.create({ name: 'Ana' });
    for (let i = 0; i < PEEK_LIMIT + 50; i++) {
      await d.repo.bodyweight.add(profile.id, { date: new Date(Date.UTC(2025, 0, 1) + i * 86_400_000).toISOString().slice(0, 10), valueKg: 60 + i / 10 });
    }
    d.timers.pending.length = 0; // drop the debounces the edits armed: only the adapter's own follow-up may drain the rest

    await d.adapter.syncNow();
    expect(await d.repo.outbox.count()).toBeGreaterThan(0);
    expect(d.timers.pending.length).toBeGreaterThan(0);

    for (let i = 0; i < 5 && (await d.repo.outbox.count()) > 0; i++) {
      d.timers.fire();
      await d.adapter.syncNow();
    }
    expect(await d.repo.outbox.count()).toBe(0);
    expect(remote.rows('bodyweight_entries')).toHaveLength(PEEK_LIMIT + 50);
  });
});
