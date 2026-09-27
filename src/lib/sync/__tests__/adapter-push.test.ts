import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { noopSyncAdapter } from '@/contracts/sync';
import { createRepository } from '@/lib/db';
import { FakeRemoteStore } from './fake-remote';
import { ACCOUNT_A, ACCOUNT_B, T0, draftFor, makeDevice, template, uuid, type Device } from './harness';

async function seed(d: Device) {
  const profile = await d.repo.profiles.create({ name: 'Ana' });
  const program = await d.repo.programs.create(profile.id, template(3), { activate: true });
  await d.repo.finishWorkout(draftFor(profile.id, T0, [[60, 8]], { programId: program.id }));
  await d.repo.bodyweight.add(profile.id, { date: '2026-03-02', valueKg: 70 });
  await d.repo.notes.set(profile.id, 'bench', 'elbows in');
  await d.repo.arsenal.add(profile.id, 'bench');
  await d.repo.equipment.save(profile.id, { stationIds: ['SMITH'] });
  return { profile, program };
}

/** Pending timers other than the 1.5 s notifyChanged debounce. */
const retryTimers = (d: Device) => d.timers.pending.filter((t) => t.ms !== 1500);

const upserts = (remote: FakeRemoteStore) => remote.calls.filter((c) => c.op === 'upsert').map((c) => c.table);

describe('push', () => {
  it('claims unowned profiles, pushes parents first and acks the outbox', async () => {
    const remote = new FakeRemoteStore({ account: ACCOUNT_A });
    const d = makeDevice(remote);
    const { profile, program } = await seed(d);
    expect(await d.repo.outbox.count()).toBeGreaterThan(5);

    const res = await d.adapter.syncNow();

    expect(res.failed).toBe(0);
    expect(res.state.status).toBe('idle');
    expect(await d.repo.outbox.count()).toBe(0);
    expect((await d.repo.profiles.get(profile.id))?.accountId).toBe(ACCOUNT_A);
    expect(upserts(remote)).toEqual([
      'family_members',
      'programs',
      'family_members',
      'workout_logs',
      'pr_records',
      'bodyweight_entries',
      'exercise_notes',
      'arsenal',
      'equipment',
    ]);
    expect(remote.row('family_members', profile.id)).toMatchObject({ profile_id: ACCOUNT_A, active_program_id: program.id, name: 'Ana' });
    expect(remote.rows('pr_records').length).toBeGreaterThan(0);
    expect(remote.rows('equipment')[0]).toMatchObject({ id: profile.id, family_member_id: profile.id, station_ids: ['SMITH'] });
  });

  it('turns a delete op into an upsert with deleted_at (tombstone), and re-pushing is harmless', async () => {
    const remote = new FakeRemoteStore({ account: ACCOUNT_A });
    const d = makeDevice(remote);
    const profile = await d.repo.profiles.create({ name: 'Ana' });
    const { log } = await d.repo.finishWorkout(draftFor(profile.id, T0, [[60, 8]]));
    await d.adapter.syncNow();
    const serverCount = remote.rows('workout_logs').length + remote.rows('pr_records').length;

    await d.repo.logs.softDelete(profile.id, log.id);
    await d.adapter.syncNow();
    expect(remote.row('workout_logs', log.id)?.deleted_at).toEqual(expect.any(String));
    expect(remote.rows('pr_records').every((r) => r.deleted_at)).toBe(true);

    await d.repo.importBackup(await d.repo.exportBackup(profile.id));
    const again = await d.adapter.syncNow();
    expect(again.failed).toBe(0);
    expect(remote.rows('workout_logs').length + remote.rows('pr_records').length).toBe(serverCount);
    expect(remote.row('workout_logs', log.id)?.deleted_at).toEqual(expect.any(String));
  });

  it('never pushes a profile owned by another account and keeps its ops queued', async () => {
    const remote = new FakeRemoteStore({ account: ACCOUNT_A });
    const d = makeDevice(remote);
    const mine = await d.repo.profiles.create({ name: 'Mine' });
    const theirs = await d.repo.profiles.create({ name: 'Theirs', accountId: ACCOUNT_B });
    await d.repo.bodyweight.add(theirs.id, { date: '2026-03-02', valueKg: 80 });

    const res = await d.adapter.syncNow();

    expect(res.failed).toBe(0);
    expect(remote.row('family_members', mine.id)).toBeDefined();
    expect(remote.row('family_members', theirs.id)).toBeUndefined();
    expect(remote.rows('bodyweight_entries')).toHaveLength(0);
    expect(await d.repo.outbox.count()).toBe(2);
    expect(d.logs).toContainEqual({ event: 'defer', code: 'other_account', count: 2 });
  });

  it('skips and acks an op whose record was wiped locally', async () => {
    const remote = new FakeRemoteStore({ account: ACCOUNT_A });
    const d = makeDevice(remote);
    const profile = await d.repo.profiles.create({ name: 'Ana' });
    const bw = await d.repo.bodyweight.add(profile.id, { date: '2026-03-02', valueKg: 70 });
    await d.db.bodyweightEntries.delete(bw.id);

    const res = await d.adapter.syncNow();

    expect(res.failed).toBe(0);
    expect(await d.repo.outbox.count()).toBe(0);
    expect(remote.rows('bodyweight_entries')).toHaveLength(0);
    expect(d.logs).toContainEqual({ event: 'skip', table: 'bodyweight_entries', code: 'missing_local', count: 1 });
  });

  it('fails an op with a non-uuid id as permanent invalid_id without sending it', async () => {
    const remote = new FakeRemoteStore({ account: ACCOUNT_A });
    const d = makeDevice(remote);
    const profile = await d.repo.profiles.create({ name: 'Ana' });
    const backup = await d.repo.exportBackup(profile.id);
    backup.bodyweightEntries = [{ id: 'local-1', profileId: profile.id, date: '2026-03-02', valueKg: 70, createdAt: T0.toISOString(), updatedAt: T0.toISOString() }];
    await d.repo.importBackup(backup);

    const res = await d.adapter.syncNow();

    expect(res.failed).toBe(1);
    expect(res.state).toMatchObject({ status: 'error', lastError: 'invalid_id' });
    const [op] = await d.repo.outbox.peek(10);
    expect(op).toMatchObject({ recordId: 'local-1', lastError: 'permanent:invalid_id', retryCount: 1 });
    expect(remote.rows('bodyweight_entries')).toHaveLength(0);
  });

  it('dead-letters a permanently rejected row, keeps pushing the rest, and later runs skip it', async () => {
    const remote = new FakeRemoteStore({ account: ACCOUNT_A });
    const d = makeDevice(remote);
    const profile = await d.repo.profiles.create({ name: 'Ana' });
    const bad = await d.repo.bodyweight.add(profile.id, { date: '2026-03-01', valueKg: 70 });
    await d.repo.bodyweight.add(profile.id, { date: '2026-03-02', valueKg: 71 });
    await d.repo.notes.set(profile.id, 'bench', 'note');
    remote.failNext('upsert', { code: '23514', retryable: false }, { table: 'bodyweight_entries', times: 2 });

    const res = await d.adapter.syncNow();

    expect(res.failed).toBe(1);
    expect(res.state.lastError).toBe('23514');
    expect(remote.rows('bodyweight_entries')).toHaveLength(1);
    expect(remote.rows('exercise_notes')).toHaveLength(1);
    expect(retryTimers(d)).toHaveLength(0);
    const dead = await d.repo.outbox.peek(10);
    expect(dead.map((o) => [o.recordId, o.lastError])).toEqual([[bad.id, 'permanent:23514']]);

    const next = await d.adapter.syncNow();
    expect(next.failed).toBe(0);
    expect(next.state.status).toBe('idle');
    expect(next.state.lastSyncedAt).toEqual(expect.any(String));

    await d.repo.bodyweight.update(profile.id, bad.id, { valueKg: 69 });
    await d.adapter.syncNow();
    expect(await d.repo.outbox.count()).toBe(0);
    expect(remote.row('bodyweight_entries', bad.id)?.value_kg).toBe(69);
  });

  it('keeps ops (not dead) on a retryable failure and schedules a retry that drains them', async () => {
    const remote = new FakeRemoteStore({ account: ACCOUNT_A });
    const d = makeDevice(remote);
    await seed(d);
    remote.failNext('upsert', { code: '503', retryable: true }, { table: 'workout_logs' });

    const res = await d.adapter.syncNow();

    expect(res.state).toMatchObject({ status: 'error', lastError: '503' });
    // The run stops at the failed upsert: nothing is pulled after it.
    const failedAt = remote.calls.findIndex((c) => c.op === 'upsert' && c.table === 'workout_logs');
    expect(failedAt).toBeGreaterThan(-1);
    expect(remote.calls.slice(failedAt).some((c) => c.op === 'pull')).toBe(false);
    const ops = await d.repo.outbox.peek(100);
    expect(ops.find((o) => o.table === 'workout_logs')?.lastError).toBe('503');
    expect(ops.some((o) => o.lastError?.startsWith('permanent:'))).toBe(false);
    expect(d.timers.delays).toContain(2000);

    d.timers.fire(2000);
    await d.adapter.syncNow();
    expect(await d.repo.outbox.count()).toBe(0);
    expect(d.adapter.getState().status).toBe('idle');
  });

  it('stops with auth_required and leaves the outbox untouched when signed out or on 401', async () => {
    const remote = new FakeRemoteStore({ account: null });
    const d = makeDevice(remote);
    await d.repo.profiles.create({ name: 'Ana' });

    const res = await d.adapter.syncNow();
    expect(res.state).toMatchObject({ status: 'error', lastError: 'auth_required', pending: 1 });
    expect(retryTimers(d)).toHaveLength(0);
    expect((await d.repo.outbox.peek(10))[0]).toMatchObject({ retryCount: 0 });

    remote.signIn(ACCOUNT_A);
    remote.failNext('upsert', { code: 'auth_required', retryable: false, authRequired: true });
    const second = await d.adapter.syncNow();
    expect(second.state.lastError).toBe('auth_required');
    expect((await d.repo.outbox.peek(10))[0].lastError).toBe('auth_required');
    expect((await d.adapter.syncNow()).state.status).toBe('idle');
  });

  it('pushes a full snapshot on the first run for an account (data written while sync was off)', async () => {
    const remote = new FakeRemoteStore({ account: ACCOUNT_A });
    const d = makeDevice(remote);
    const offline = createRepository({ db: d.db, sync: noopSyncAdapter, newId: uuid, now: d.now });
    const profile = await offline.profiles.create({ name: 'Ana', accountId: ACCOUNT_A });
    await offline.finishWorkout(draftFor(profile.id, T0, [[50, 5]]));
    await offline.bodyweight.add(profile.id, { date: '2026-03-02', valueKg: 70 });
    expect(await d.repo.outbox.count()).toBe(0);

    await d.adapter.syncNow();
    expect(remote.rows('family_members')).toHaveLength(1);
    expect(remote.rows('workout_logs')).toHaveLength(1);
    expect(remote.rows('bodyweight_entries')).toHaveLength(1);

    await offline.bodyweight.add(profile.id, { date: '2026-03-03', valueKg: 71 });
    await d.adapter.syncNow();
    expect(remote.rows('bodyweight_entries')).toHaveLength(1);
  });
});
