/**
 * Conflict and recovery cases against the local Supabase stack (npm run
 * test:sync), from the 2026-09-26 refuter run: device clock skew, the pull vs
 * local-edit race, sticky tombstones after an undo, the snapshot after a lost
 * cursor store, a backup of another account, backlogs over one peek window
 * and non-uuid ids. Each test was red before its fix. Sequential by design.
 */
import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import type { SupabaseClient } from '@supabase/supabase-js';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { LAST_SYNCED_KEY } from '../cursors';
import { UUID_RE } from '../mapper';
import { MemoryStorage } from './harness';
import {
  adminClient,
  countRows,
  createLiveUser,
  liveDevice,
  programTemplate,
  requireLiveEnv,
  signedInClient,
  workoutDraft,
  type LiveDevice,
  type LiveEnv,
  type LiveUser,
} from './live-harness';

const HOUR = 3_600_000;
let env: LiveEnv;
let admin: SupabaseClient;
const users: LiveUser[] = [];
const devices: LiveDevice[] = [];
let userA: LiveUser;
let userC: LiveUser;
/** Device clock one hour ahead of the server. */
let fast: LiveDevice;
/** Device clock one hour behind the server. */
let slow: LiveDevice;
let B: LiveDevice;
let profileId = '';

function track(d: LiveDevice): LiveDevice {
  devices.push(d);
  return d;
}

beforeAll(async () => {
  env = requireLiveEnv();
  admin = adminClient(env);
  userA = await createLiveUser(admin, 'skew-a');
  userC = await createLiveUser(admin, 'skew-c');
  users.push(userA, userC);
  fast = track(liveDevice('fast', await signedInClient(env, userA), new MemoryStorage(), { now: () => new Date(Date.now() + HOUR) }));
  slow = track(liveDevice('slow', await signedInClient(env, userA), new MemoryStorage(), { now: () => new Date(Date.now() - HOUR) }));
  B = track(liveDevice('B', await signedInClient(env, userA)));
  profileId = (await B.repo.profiles.ensureActive('Ana')).id;
  expect((await B.adapter.syncNow()).state.status).toBe('idle');
  await fast.adapter.syncNow();
  await slow.adapter.syncNow();
}, 60_000);

afterEach(() => {
  vi.restoreAllMocks();
});

afterAll(async () => {
  for (const d of devices) d.adapter.dispose();
  const failed: string[] = [];
  for (const u of users) {
    const { error } = await admin.auth.admin.deleteUser(u.id);
    if (error) failed.push(`${error.status ?? '?'} ${error.code ?? ''}`);
  }
  if (failed.length > 0) throw new Error(`admin.deleteUser failed for ${failed.length} test user(s): ${failed.join(', ')}`);
});

describe('conflicts against local Supabase', () => {
  it('a device with a clock 1 h ahead converges to a later edit from another device, and does not push its stale copy back', async () => {
    const program = await fast.repo.programs.create(profileId, programTemplate('Original'));
    expect((await fast.adapter.syncNow()).failed).toBe(0);
    await B.adapter.syncNow();
    await B.repo.programs.update(profileId, program.id, { name: 'Edited on B' });
    expect((await B.adapter.syncNow()).failed).toBe(0);

    const run = await fast.adapter.syncNow();
    expect(run.state.status).toBe('idle');
    expect(run.pulled).toBeGreaterThanOrEqual(1);
    expect((await fast.repo.programs.get(profileId, program.id))?.name).toBe('Edited on B');

    // The fast device then edits another field; the name must survive.
    await fast.repo.programs.update(profileId, program.id, { frequency: 4 });
    await fast.adapter.syncNow();
    const server = await B.client.from('programs').select('name, frequency').eq('id', program.id).single();
    expect(server.data).toEqual({ name: 'Edited on B', frequency: 4 });
  });

  it('a local edit that lands while a pulled page is applied survives on a device with a clock 1 h behind', async () => {
    const bw = await B.repo.bodyweight.add(profileId, { date: '2026-09-20', valueKg: 80 });
    await B.adapter.syncNow();
    await slow.adapter.syncNow();
    await B.repo.bodyweight.update(profileId, bw.id, { valueKg: 85 });
    await B.adapter.syncNow();

    let armed = false;
    let edit: Promise<unknown> | null = null;
    const pull = slow.remote.pull.bind(slow.remote);
    vi.spyOn(slow.remote, 'pull').mockImplementation(async (table, since, afterId, limit) => {
      if (table === 'bodyweight_entries') armed = true;
      return pull(table, since, afterId, limit);
    });
    const userEdit = () => {
      if (armed && !edit) edit = Dexie.ignoreTransaction(() => slow.repo.bodyweight.update(profileId, bw.id, { valueKg: 99 }));
    };
    for (const m of ['peek', 'count'] as const) {
      const real = slow.repo.outbox[m].bind(slow.repo.outbox) as (n?: number) => Promise<unknown>;
      vi.spyOn(slow.repo.outbox, m).mockImplementation((async (n?: number) => {
        const out = await real(n);
        userEdit();
        return out;
      }) as never);
    }

    await slow.adapter.syncNow();
    await edit;
    vi.restoreAllMocks();
    expect(edit).not.toBeNull();
    expect((await slow.repo.bodyweight.list(profileId)).find((e) => e.id === bw.id)?.valueKg).toBe(99);

    await slow.adapter.syncNow();
    await B.adapter.syncNow();
    const server = await B.client.from('bodyweight_entries').select('value_kg').eq('id', bw.id).single();
    expect(server.data?.value_kg).toBe(99);
    expect((await B.repo.bodyweight.list(profileId)).find((e) => e.id === bw.id)?.valueKg).toBe(99);
  });

  it('undo delete, re-add to the arsenal and a rewritten note reach the server and the other devices', async () => {
    const exerciseId = 'tytax-bench-press';
    const entry = await B.repo.arsenal.add(profileId, exerciseId);
    const note = await B.repo.notes.set(profileId, exerciseId, 'first note');
    const { log } = await B.repo.finishWorkout(workoutDraft(profileId, undefined, undefined));
    await B.adapter.syncNow();
    await B.repo.arsenal.remove(profileId, exerciseId);
    await B.repo.notes.set(profileId, exerciseId, '');
    await B.repo.logs.softDelete(profileId, log.id);
    await B.adapter.syncNow();
    await B.repo.arsenal.add(profileId, exerciseId);
    await B.repo.notes.set(profileId, exerciseId, 'second note');
    await B.repo.logs.restore(profileId, log.id);

    const run = await B.adapter.syncNow();
    expect(run.failed).toBe(0);
    expect(run.state).toMatchObject({ status: 'idle', pending: 0 });
    for (const [table, id] of [['arsenal', entry.id], ['exercise_notes', note?.id], ['workout_logs', log.id]] as const) {
      const row = await B.client.from(table).select('deleted_at').eq('id', String(id)).single();
      expect({ table, deleted_at: row.data?.deleted_at }).toEqual({ table, deleted_at: null });
    }
    await fast.adapter.syncNow();
    for (const d of [B, fast]) {
      expect(await d.repo.arsenal.has(profileId, exerciseId)).toBe(true);
      expect((await d.repo.notes.get(profileId, exerciseId))?.content).toBe('second note');
      expect(await d.repo.logs.get(profileId, log.id)).toBeDefined();
    }
  });

  it('a device that lost its cursor store (same IndexedDB) does not overwrite a newer server row', async () => {
    const bw = await B.repo.bodyweight.add(profileId, { date: '2026-09-21', valueKg: 70 });
    await B.adapter.syncNow();
    await fast.adapter.syncNow();
    await fast.repo.bodyweight.update(profileId, bw.id, { valueKg: 90 });
    await fast.adapter.syncNow();

    const reborn = track(liveDevice('B-reborn', await signedInClient(env, userA), new MemoryStorage(), { db: B.db }));
    const run = await reborn.adapter.syncNow();
    expect(run.failed).toBe(0);
    expect(run.pushed).toBe(0);
    const server = await B.client.from('bodyweight_entries').select('value_kg').eq('id', bw.id).single();
    expect(server.data?.value_kg).toBe(90);
    expect((await reborn.repo.bodyweight.list(profileId)).find((e) => e.id === bw.id)?.valueKg).toBe(90);
  });

  it('drains a backlog of 450 ops in one run', async () => {
    const before = await countRows(B.client, 'bodyweight_entries');
    await B.repo.transaction(async () => {
      for (let i = 0; i < 450; i++) await B.repo.bodyweight.add(profileId, { date: '2026-09-22', valueKg: 60 + (i % 30) });
    });
    const run = await B.adapter.syncNow();
    expect(run.failed).toBe(0);
    expect(run.pushed).toBe(450);
    expect(run.state).toMatchObject({ status: 'idle', pending: 0 });
    expect(await countRows(B.client, 'bodyweight_entries')).toBe(before + 450);
  });

  it('the server refuses more than 200 rows per request (PT413, HTTP 413) and the client classifies it as permanent', async () => {
    const rows = (n: number) =>
      Array.from({ length: n }, () => ({ id: crypto.randomUUID(), family_member_id: profileId, date: '2026-09-24', value_kg: 70, extra: {} }));
    const before = await countRows(B.client, 'bodyweight_entries');
    const big = await B.client.from('bodyweight_entries').insert(rows(201));
    expect({ status: big.status, code: big.error?.code }).toEqual({ status: 413, code: 'PT413' });
    const ok = await B.client.from('bodyweight_entries').insert(rows(100));
    expect(ok.error).toBeNull();
    expect(await countRows(B.client, 'bodyweight_entries')).toBe(before + 100);
    const res = await B.remote.upsert('bodyweight_entries', rows(201));
    expect(res).toEqual({ ok: false, error: { code: 'PT413', retryable: false } });
  });

  it('a non-uuid id is failed as invalid_id and never reaches the wire', async () => {
    const backup = await B.repo.exportBackup(profileId);
    const now = new Date().toISOString();
    const bad = { id: 'not-a-uuid', profileId, date: '2026-09-23', valueKg: 71, createdAt: now, updatedAt: now };
    await B.repo.importBackup({ ...backup, profiles: [], workoutLogs: [], programs: [], prRecords: [], exerciseNotes: [], arsenal: [], equipment: [], bodyweightEntries: [bad] });
    const before = await countRows(B.client, 'bodyweight_entries');

    const run = await B.adapter.syncNow();

    expect(run.failed).toBe(1);
    expect(run.state).toMatchObject({ status: 'error', lastError: 'invalid_id', pending: 1 });
    expect((await B.repo.outbox.peek(10))[0].lastError).toBe('permanent:invalid_id');
    expect(await countRows(B.client, 'bodyweight_entries')).toBe(before);
    const refs = ['id', 'profile_id', 'family_member_id', 'program_id', 'workout_log_id', 'active_program_id'];
    const wire = B.remote.upserts.flatMap(({ table, row }) => refs.filter((k) => row[k] != null).map((k) => `${table}.${k}=${String(row[k])}`));
    expect(wire.filter((v) => !UUID_RE.test(v.split('=')[1]))).toEqual([]);
    // Clean up the dead letter so later runs are idle again.
    await B.repo.outbox.ack((await B.repo.outbox.peek(10)).map((o) => o.id));
  });

  it("a backup of account A imported while C is signed in is reported, never marked synced, and A's rows stay untouched", async () => {
    const program = await B.repo.programs.create(profileId, programTemplate('A only'));
    await B.adapter.syncNow();
    const backup = await B.repo.exportBackup(profileId);
    expect(backup.profiles[0].accountId).toBe(userA.id);

    const C = track(liveDevice('C', await signedInClient(env, userC)));
    await C.repo.importBackup(backup);
    const run = await C.adapter.syncNow();

    expect(run.state).toMatchObject({ status: 'error', lastError: 'other_account', lastSyncedAt: null });
    expect(run.state.pending).toBeGreaterThan(0);
    expect(C.storage.getItem(LAST_SYNCED_KEY)).toBeNull();
    expect(await countRows(C.client, 'family_members')).toBe(0);
    const aRow = await B.client.from('programs').select('name, profile_id').eq('id', program.id).single();
    expect(aRow.data).toEqual({ name: 'A only', profile_id: userA.id });
  });
});
