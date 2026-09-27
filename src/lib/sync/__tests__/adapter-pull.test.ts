import 'fake-indexeddb/auto';
import { describe, expect, it, vi } from 'vitest';
import { cursorKey } from '../cursors';
import { FakeRemoteStore } from './fake-remote';
import { ACCOUNT_A, T0, draftFor, makeDevice, template, type Device } from './harness';

async function counts(d: Device) {
  const profiles = await d.repo.profiles.list({ includeDeleted: true });
  let rows = profiles.length;
  for (const p of profiles) {
    const b = await d.repo.exportBackup(p.id);
    rows += b.workoutLogs.length + b.programs.length + b.prRecords.length + b.bodyweightEntries.length + b.exerciseNotes.length + b.arsenal.length + b.equipment.length;
  }
  return rows;
}

function pair() {
  const remote = new FakeRemoteStore({ account: ACCOUNT_A });
  return { remote, a: makeDevice(remote), b: makeDevice(remote) };
}

describe('pull', () => {
  it('round-trips a finished workout with PRs and program rotation from device A to device B', async () => {
    const { a, b } = pair();
    const profile = await a.repo.profiles.create({ name: 'Ana', avatarColor: '#fff' });
    const program = await a.repo.programs.create(profile.id, template(3), { activate: true });
    await a.repo.finishWorkout(draftFor(profile.id, T0, [[60, 8]], { programId: program.id }));
    a.tick(86_400_000);
    const second = await a.repo.finishWorkout(draftFor(profile.id, a.now(), [[70, 8]], { programId: program.id }), { rpe: 8 });
    expect(second.prs.some((p) => !p.isBaseline)).toBe(true);
    await a.adapter.syncNow();

    const res = await b.adapter.syncNow();

    expect(res.failed).toBe(0);
    expect(res.pulled).toBeGreaterThan(5);
    const bProfile = await b.repo.profiles.get(profile.id);
    expect(bProfile).toMatchObject({ name: 'Ana', avatarColor: '#fff', accountId: ACCOUNT_A, activeProgramId: program.id });
    expect((await b.repo.programs.getActive(profile.id))?.currentSessionIndex).toBe(2);
    const logs = await b.repo.logs.list(profile.id);
    expect(logs.map((l) => l.id)).toEqual((await a.repo.logs.list(profile.id)).map((l) => l.id));
    expect(logs[0]).toMatchObject({ rpe: 8, prCount: second.log.prCount, totalVolumeKg: 560, exercises: second.log.exercises });
    const aPrs = await a.repo.prs.list(profile.id);
    expect((await b.repo.prs.list(profile.id)).map((p) => [p.id, p.value]).sort()).toEqual(aPrs.map((p) => [p.id, p.value]).sort());
    expect(await b.repo.outbox.count()).toBe(0);
  });

  it('propagates a tombstone from device A through the server to device B', async () => {
    const { remote, a, b } = pair();
    const profile = await a.repo.profiles.create({ name: 'Ana' });
    const { log } = await a.repo.finishWorkout(draftFor(profile.id, T0, [[60, 8]]));
    await a.adapter.syncNow();
    await b.adapter.syncNow();
    expect(await b.repo.logs.get(profile.id, log.id)).toBeDefined();

    a.tick();
    await a.repo.logs.softDelete(profile.id, log.id);
    await a.adapter.syncNow();
    await b.adapter.syncNow();

    expect(remote.row('workout_logs', log.id)?.deleted_at).toEqual(expect.any(String));
    expect(await b.repo.logs.get(profile.id, log.id)).toBeUndefined();
    expect((await b.repo.logs.get(profile.id, log.id, { includeDeleted: true }))?.deletedAt).toEqual(expect.any(String));
    expect((await b.repo.prs.list(profile.id)).length).toBe(0);
  });

  it('server wins for a record without a queued op, even when its local updatedAt is later (clock ahead)', async () => {
    const { a, b } = pair();
    const profile = await a.repo.profiles.create({ name: 'Ana' });
    const bw = await a.repo.bodyweight.add(profile.id, { date: '2026-03-02', valueKg: 70 });
    await a.adapter.syncNow();
    await b.adapter.syncNow();
    // A stamp an hour in the future and no outbox op (not a local change to push).
    const future = new Date(T0.getTime() + 3_600_000).toISOString();
    await b.db.bodyweightEntries.update(bw.id, { valueKg: 99, updatedAt: future });

    await a.repo.bodyweight.update(profile.id, bw.id, { valueKg: 71 });
    await a.adapter.syncNow();
    const run = await b.adapter.syncNow();
    expect(run.pulled).toBe(1);
    expect((await b.db.bodyweightEntries.get(bw.id))?.valueKg).toBe(71);
    // The local stamp only moves forward, so local sorts never go back in time.
    expect(String((await b.db.bodyweightEntries.get(bw.id))?.updatedAt) > future).toBe(true);

    // Re-pulling the same server row again changes nothing.
    const again = await b.adapter.syncNow();
    expect(again.pulled).toBe(0);
  });

  it('does not let a pull overwrite a record changed locally during the run', async () => {
    const { remote, a, b } = pair();
    const profile = await a.repo.profiles.create({ name: 'Ana' });
    const bw = await a.repo.bodyweight.add(profile.id, { date: '2026-03-02', valueKg: 70 });
    await a.adapter.syncNow();
    await a.repo.bodyweight.update(profile.id, bw.id, { valueKg: 75 });
    await a.adapter.syncNow();
    await b.adapter.syncNow();
    remote.advance(60_000);
    await a.repo.bodyweight.update(profile.id, bw.id, { valueKg: 76 });
    await a.adapter.syncNow();
    const pull = remote.pull.bind(remote);
    // B edits the record after its push step and before its pull step.
    vi.spyOn(remote, 'pull').mockImplementation(async (table, since, afterId, limit) => {
      if (table === 'family_members') await b.repo.bodyweight.update(profile.id, bw.id, { valueKg: 80 });
      return pull(table, since, afterId, limit);
    });

    await b.adapter.syncNow();
    expect((await b.db.bodyweightEntries.get(bw.id))?.valueKg).toBe(80);
    expect(await b.repo.outbox.count()).toBe(1);

    vi.mocked(remote.pull).mockRestore();
    await b.adapter.syncNow();
    await a.adapter.syncNow();
    expect((await a.db.bodyweightEntries.get(bw.id))?.valueKg).toBe(80);
  });

  it('advances a cursor only after applyRemote resolves; a failed apply is re-pulled next run', async () => {
    const { a, b } = pair();
    const profile = await a.repo.profiles.create({ name: 'Ana' });
    await a.repo.finishWorkout(draftFor(profile.id, T0, [[60, 8]]));
    await a.adapter.syncNow();
    const original = b.repo.applyRemote.bind(b.repo);
    const apply = vi.spyOn(b.repo, 'applyRemote').mockImplementation(async (table, rows) => {
      if (table === 'workout_logs') throw new Error('disk full');
      return original(table, rows);
    });

    const res = await b.adapter.syncNow();

    expect(res.state).toMatchObject({ status: 'error', lastError: 'apply_failed' });
    const cursor = (t: 'workout_logs' | 'profiles') => JSON.parse(b.storage.getItem(cursorKey(ACCOUNT_A, t)) ?? '{}');
    expect(cursor('workout_logs').lastPulledAt ?? null).toBeNull();
    expect(b.storage.getItem(cursorKey(ACCOUNT_A, 'profiles'))).toContain('lastPulledAt');
    expect(await b.repo.logs.list(profile.id)).toHaveLength(0);

    apply.mockRestore();
    b.timers.fire(2000);
    await b.adapter.syncNow();
    expect(await b.repo.logs.list(profile.id)).toHaveLength(1);
    expect(JSON.parse(b.storage.getItem(cursorKey(ACCOUNT_A, 'workout_logs')) ?? '{}').lastPulledAt).toEqual(expect.any(String));
  });

  it('re-pulls the 5 s overlap idempotently (row counts unchanged)', async () => {
    const { remote, a, b } = pair();
    const profile = await a.repo.profiles.create({ name: 'Ana' });
    await a.repo.finishWorkout(draftFor(profile.id, T0, [[60, 8]]));
    await a.adapter.syncNow();
    await b.adapter.syncNow();
    const before = await counts(b);

    remote.calls.length = 0;
    await b.adapter.syncNow();

    const repulled = remote.calls.filter((c) => c.op === 'pull').reduce((n, c) => n + c.rows, 0);
    expect(repulled).toBeGreaterThan(0);
    expect(await counts(b)).toBe(before);
    expect(await b.repo.outbox.count()).toBe(0);
  });

  it('pages with a keyset (no row lost or duplicated across pages)', async () => {
    const remote = new FakeRemoteStore({ account: ACCOUNT_A });
    const a = makeDevice(remote);
    const b = makeDevice(remote, { pageSize: 2 });
    const profile = await a.repo.profiles.create({ name: 'Ana' });
    for (let i = 1; i <= 5; i++) await a.repo.bodyweight.add(profile.id, { date: `2026-03-0${i}`, valueKg: 70 + i });
    await a.adapter.syncNow();
    remote.calls.length = 0;

    await b.adapter.syncNow();

    expect(await b.repo.bodyweight.list(profile.id)).toHaveLength(5);
    expect(remote.calls.filter((c) => c.op === 'pull' && c.table === 'bodyweight_entries').map((c) => c.rows)).toEqual([2, 2, 1]);
    expect(JSON.parse(b.storage.getItem(cursorKey(ACCOUNT_A, 'bodyweight_entries')) ?? '{}').lastPulledId).toEqual(expect.any(String));
  });
});
