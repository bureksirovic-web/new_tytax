/**
 * Refuter R1 (2026-09-27): the signed-in account switches while a push is in
 * flight. The run captured account A; the upsert then runs under B's session
 * and RLS answers 42501. That denial is about the session, not the row: the
 * op must stay live (never dead-lettered) and push once A signs back in.
 * Before the fix the op was dead-lettered as `permanent:42501` and the next
 * pull overwrote the unsent local edit.
 */
import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RemoteStore } from '../remote';
import { FakeRemoteStore } from './fake-remote';
import { ACCOUNT_A, ACCOUNT_B, T0, draftFor, makeDevice } from './harness';

afterEach(() => {
  vi.restoreAllMocks();
});

/** Runs `action` once, right before the next upsert of `table` after `arm()`. */
function beforeUpsert(inner: FakeRemoteStore, table: string, action: () => void): { store: RemoteStore; arm: () => void } {
  let armed = false;
  return {
    arm: () => (armed = true),
    store: {
      upsert: async (t, rows) => {
        if (armed && t === table) {
          armed = false;
          action();
        }
        return inner.upsert(t, rows);
      },
      pull: (t, since, after, limit) => inner.pull(t, since, after, limit),
      undelete: (t, id) => inner.undelete(t, id),
      currentAccountId: () => inner.currentAccountId(),
      onAuthChange: (cb) => inner.onAuthChange(cb),
    },
  };
}

async function editedLog(event: () => void) {
  const remote = new FakeRemoteStore({ account: ACCOUNT_A, start: T0 });
  const hook = beforeUpsert(remote, 'workout_logs', event);
  const d = makeDevice(hook.store);
  const profile = await d.repo.profiles.create({ name: 'Ana' });
  const { log } = await d.repo.finishWorkout(draftFor(profile.id, T0, [[60, 8]]));
  expect((await d.adapter.syncNow()).state.status).toBe('idle');
  await d.repo.logs.update(profile.id, log.id, { notes: 'unsent edit' });
  expect(await d.repo.outbox.count()).toBe(1);
  hook.arm();
  return { remote, d, profile, log };
}

describe('account switch during a push', () => {
  it('keeps the op live when B signs in mid-push, and pushes it when A returns', async () => {
    const { remote, d, profile, log } = await editedLog(() => remote.signIn(ACCOUNT_B, 'SIGNED_IN'));
    const run = await d.adapter.syncNow();

    const ops = await d.repo.outbox.peek(10);
    expect(ops.map((o) => o.lastError)).toEqual(['account_changed']);
    expect(run.state.lastError).toBe('account_changed');
    expect(run.failed).toBe(0);
    expect((await d.repo.logs.get(profile.id, log.id))?.notes).toBe('unsent edit');

    remote.signIn(ACCOUNT_A, 'SIGNED_IN');
    const back = await d.adapter.syncNow();
    expect(back.state.status).toBe('idle');
    expect(await d.repo.outbox.count()).toBe(0);
    expect(remote.row('workout_logs', log.id)!.notes).toBe('unsent edit');
    expect((await d.repo.logs.get(profile.id, log.id))?.notes).toBe('unsent edit');
    d.adapter.dispose();
  });

  it('keeps the op live when the session signs out mid-push', async () => {
    const { remote, d, log } = await editedLog(() => {
      remote.signIn(null, 'SIGNED_OUT');
    });
    // The fake answers a signed-out upsert with auth_required; force the RLS shape a real server gives an anon JWT.
    remote.failNext('upsert', { code: '42501', retryable: false }, { table: 'workout_logs' });
    const run = await d.adapter.syncNow();
    expect(run.state.lastError).toBe('account_changed');
    expect((await d.repo.outbox.peek(10)).map((o) => o.lastError)).toEqual(['account_changed']);

    remote.signIn(ACCOUNT_A, 'SIGNED_IN');
    expect((await d.adapter.syncNow()).state.status).toBe('idle');
    expect(remote.row('workout_logs', log.id)!.notes).toBe('unsent edit');
    d.adapter.dispose();
  });

  it('still dead-letters a 42501 while the session is unchanged (the row itself is refused)', async () => {
    const { remote, d } = await editedLog(() => undefined);
    remote.failNext('upsert', { code: '42501', retryable: false }, { table: 'workout_logs' });
    const run = await d.adapter.syncNow();
    expect(run.failed).toBe(1);
    expect(run.state.lastError).toBe('42501');
    expect((await d.repo.outbox.peek(10)).map((o) => o.lastError)).toEqual(['permanent:42501']);
    d.adapter.dispose();
  });

  it('keeps the op live when the account cannot be re-read after a 42501', async () => {
    const { remote, d } = await editedLog(() => undefined);
    remote.failNext('upsert', { code: '42501', retryable: false }, { table: 'workout_logs' });
    const who = vi.spyOn(remote, 'currentAccountId');
    let calls = 0;
    who.mockImplementation(async () => {
      calls += 1;
      if (calls === 2) throw new Error('offline');
      return ACCOUNT_A;
    });
    const run = await d.adapter.syncNow();
    expect(run.failed).toBe(0);
    expect(run.state.lastError).toBe('network');
    expect((await d.repo.outbox.peek(10)).map((o) => o.lastError)).toEqual(['network']);
    d.adapter.dispose();
  });
});
