/**
 * AC12 (PLAN §10.2) against the local Supabase stack: `npm run test:sync`.
 * Missing env fails the suite in beforeAll with instructions; nothing is skipped.
 *
 * Tests run in file order and build on each other (one account A with two
 * devices, one stranger C), so the file is sequential by design.
 */
import 'fake-indexeddb/auto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Program } from '@/contracts/domain';
import { cursorKey } from '../cursors';
import { UUID_RE, toRemote } from '../mapper';
import { MemoryStorage } from './harness';
import {
  WIRE_TABLES,
  adminClient,
  comparable,
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

let env: LiveEnv;
let admin: SupabaseClient;
const users: LiveUser[] = [];
let userA: LiveUser;
let userC: LiveUser;
let A: LiveDevice;
let B: LiveDevice;
let C: SupabaseClient;

/** Shared across tests (sequential file). */
const ctx: { profileId: string; program?: Program; logId?: string } = { profileId: '' };

beforeAll(async () => {
  env = requireLiveEnv();
  admin = adminClient(env);
  userA = await createLiveUser(admin, 'a');
  userC = await createLiveUser(admin, 'c');
  users.push(userA, userC);
  A = liveDevice('A', await signedInClient(env, userA));
  B = liveDevice('B', await signedInClient(env, userA));
  C = await signedInClient(env, userC);
}, 60_000);

afterAll(async () => {
  A?.adapter.dispose();
  B?.adapter.dispose();
  // ON DELETE CASCADE from auth.users removes every row the users own.
  const failed: string[] = [];
  for (const u of users) {
    const { error } = await admin.auth.admin.deleteUser(u.id);
    if (error) failed.push(`${error.status ?? '?'} ${error.code ?? ''}`);
  }
  if (failed.length > 0) throw new Error(`admin.deleteUser failed for ${failed.length} test user(s): ${failed.join(', ')}`);
});

describe('sync against local Supabase (AC12)', () => {
  it('signup creates the account profiles row, readable by its owner only', async () => {
    const own = await A.client.from('profiles').select('id').eq('id', userA.id);
    expect(own.error).toBeNull();
    expect(own.data).toEqual([{ id: userA.id }]);

    const foreign = await C.from('profiles').select('id').eq('id', userA.id);
    expect(foreign.error).toBeNull();
    expect(foreign.data).toEqual([]);
  });

  it('round trip: device A finishes a workout (+ rotation, PRs, bodyweight, note, arsenal, equipment), device B gets identical records', async () => {
    const profile = await A.repo.profiles.ensureActive('Ana');
    ctx.profileId = profile.id;
    const program = await A.repo.programs.create(profile.id, programTemplate('PPL live'), { activate: true });
    // Two workouts: the first sets baselines, the second beats them (real PRs).
    await A.repo.finishWorkout(workoutDraft(profile.id, program.id, program.sessions[0].id), { rpe: 7, notes: 'first' });
    const second = workoutDraft(profile.id, program.id, program.sessions[1].id);
    second.exercises[0].sets[2].kg = 95;
    const finished = await A.repo.finishWorkout(second, { rpe: 8, notes: 'second' });
    ctx.logId = finished.log.id;
    await A.repo.bodyweight.add(profile.id, { date: '2026-09-20', valueKg: 81.5 });
    await A.repo.notes.set(profile.id, 'tytax-bench-press', 'Elbows tucked');
    await A.repo.arsenal.add(profile.id, 'tytax-bench-press');
    await A.repo.equipment.save(profile.id, { stationIds: ['press-station'], kettlebellsKg: [16, 24], bodyweightGear: ['pull-up-bar'] });

    expect(finished.advancedProgram?.nextSessionIndex).toBe(2);
    expect(finished.prs.some((p) => !p.isBaseline)).toBe(true);

    const pushed = await A.adapter.syncNow();
    expect(pushed.failed).toBe(0);
    expect(pushed.state.status).toBe('idle');
    expect(pushed.state.pending).toBe(0);
    expect(pushed.pushed).toBeGreaterThanOrEqual(9);

    const pulled = await B.adapter.syncNow();
    expect(pulled.state.status).toBe('idle');
    expect(pulled.pulled).toBeGreaterThanOrEqual(9);

    const a = comparable(await A.repo.exportBackup());
    const b = comparable(await B.repo.exportBackup());
    expect(a.workoutLogs).toHaveLength(2);
    expect(a.prRecords.length).toBeGreaterThanOrEqual(2);
    for (const key of Object.keys(a)) expect({ table: key, rows: b[key] }).toEqual({ table: key, rows: a[key] });

    const bProgram = await B.repo.programs.getActive(profile.id);
    expect(bProgram?.currentSessionIndex).toBe(2);
    ctx.program = bProgram;
  });

  it('no local ids on the wire: every id / *_id that references a row is a uuid', () => {
    const refs = ['id', 'profile_id', 'family_member_id', 'program_id', 'workout_log_id', 'active_program_id'];
    const bad: string[] = [];
    for (const { table, row } of A.remote.upserts) {
      for (const k of refs) {
        const v = row[k];
        if (v === undefined || (v === null && k !== 'id')) continue;
        if (typeof v !== 'string' || !UUID_RE.test(v)) bad.push(`${table}.${k}=${String(v)}`);
      }
    }
    expect(A.remote.upserts.length).toBeGreaterThanOrEqual(9);
    expect(new Set(A.remote.upserts.map((u) => u.table))).toEqual(new Set(WIRE_TABLES));
    expect(bad).toEqual([]);
  });

  it("cross-user: C cannot SELECT, INSERT, UPDATE or DELETE A's rows through the REST API", async () => {
    const logId = ctx.logId as string;
    for (const table of WIRE_TABLES) expect({ table, rows: await countRows(C, table) }).toEqual({ table, rows: 0 });

    const sel = await C.from('workout_logs').select('id').eq('id', logId);
    expect(sel.data).toEqual([]);

    // A complete, valid row (A's own log under a new id), so only ownership can reject it.
    const log = await A.repo.logs.get(ctx.profileId, logId);
    const asC = toRemote('workout_logs', { ...log, id: crypto.randomUUID() } as Record<string, unknown>, userC.id);
    const intoA = await C.from('workout_logs').insert(asC).select('id');
    expect(intoA.data).toBeNull();
    expect(['42501', '23503']).toContain(intoA.error?.code);
    const claimA = await C.from('workout_logs').insert({ ...asC, id: crypto.randomUUID(), profile_id: userA.id }).select('id');
    expect(claimA.data).toBeNull();
    expect(claimA.error?.code).toBe('42501');

    // Upsert over A's id: must neither steal nor overwrite the row.
    const hijack = await C.from('workout_logs').upsert({ ...asC, id: logId, session_name: 'stolen' }).select('id');
    expect(hijack.data ?? []).toEqual([]);
    expect(hijack.error).not.toBeNull();

    const upd = await C.from('workout_logs').update({ notes: 'hacked' }).eq('id', logId).select('id');
    expect(upd.error).toBeNull();
    expect(upd.data).toEqual([]);

    const del = await C.from('workout_logs').delete().eq('id', logId).select('id');
    expect(del.data ?? []).toEqual([]);

    const still = await A.client.from('workout_logs').select('id, notes, session_name, deleted_at').eq('id', logId).single();
    expect(still.error).toBeNull();
    expect(still.data).toEqual({ id: logId, notes: 'second', session_name: 'Push', deleted_at: null });
  });

  it('tombstone: A deletes a log, B sees deletedAt after sync', async () => {
    const logId = ctx.logId as string;
    await A.repo.logs.softDelete(ctx.profileId, logId);
    const a = await A.adapter.syncNow();
    expect(a.failed).toBe(0);
    expect(a.state.pending).toBe(0);

    const server = await A.client.from('workout_logs').select('deleted_at').eq('id', logId).single();
    expect(server.data?.deleted_at).toEqual(expect.any(String));

    await B.adapter.syncNow();
    const onB = await B.repo.logs.get(ctx.profileId, logId, { includeDeleted: true });
    expect(onB?.deletedAt).toEqual(expect.any(String));
    expect(await B.repo.logs.get(ctx.profileId, logId)).toBeUndefined();
    expect((await B.repo.logs.list(ctx.profileId)).map((l) => l.id)).not.toContain(logId);
  });

  it('conflict: A and B edit the same program offline, B pushes last, both converge to B (server updated_at order)', async () => {
    const programId = (ctx.program as Program).id;
    await A.repo.programs.update(ctx.profileId, programId, { name: 'Edited on A' });
    await B.repo.programs.update(ctx.profileId, programId, { name: 'Edited on B' });

    const first = await A.adapter.syncNow();
    const last = await B.adapter.syncNow();
    expect(first.failed).toBe(0);
    expect(last.failed).toBe(0);
    await A.adapter.syncNow();

    const server = await A.client.from('programs').select('name').eq('id', programId).single();
    expect(server.data?.name).toBe('Edited on B');
    expect((await A.repo.programs.get(ctx.profileId, programId))?.name).toBe('Edited on B');
    expect((await B.repo.programs.get(ctx.profileId, programId))?.name).toBe('Edited on B');
  });

  it('retry cursor: a failed applyRemote leaves the cursor unchanged; the next sync completes with the right counts', async () => {
    const entry = await A.repo.bodyweight.add(ctx.profileId, { date: '2026-09-22', valueKg: 80.9 });
    await A.repo.bodyweight.add(ctx.profileId, { date: '2026-09-23', valueKg: 80.4 });
    expect((await A.adapter.syncNow()).failed).toBe(0);

    const key = cursorKey(userA.id, 'bodyweight_entries');
    const before = B.storage.getItem(key);
    expect(before).not.toBeNull();

    B.failNextApply();
    const failed = await B.adapter.syncNow();
    expect(failed.state.status).toBe('error');
    expect(failed.state.lastError).toBe('apply_failed');
    expect(B.storage.getItem(key)).toBe(before);
    expect(await B.repo.bodyweight.list(ctx.profileId)).toHaveLength(1);

    const ok = await B.adapter.syncNow();
    expect(ok.state.status).toBe('idle');
    expect(ok.pulled).toBe(2);
    expect(B.storage.getItem(key)).not.toBe(before);
    const values = (await B.repo.bodyweight.list(ctx.profileId)).map((e) => e.valueKg).sort();
    expect(values).toEqual([80.4, 80.9, 81.5]);
    expect((await B.repo.bodyweight.list(ctx.profileId)).map((e) => e.id)).toContain(entry.id);
  });

  it('idempotent re-push: pushing every record again leaves every server row count unchanged', async () => {
    const counts = async () => Object.fromEntries(await Promise.all(WIRE_TABLES.map(async (t) => [t, await countRows(A.client, t)] as const)));
    const before = await counts();
    expect(before.workout_logs).toBe(2);

    // A third device for the same account with empty cursors and A's data:
    // its first run pushes the full snapshot again (same ids).
    const again = liveDevice('A2', await signedInClient(env, userA), new MemoryStorage());
    await again.repo.importBackup(await A.repo.exportBackup());
    const first = await again.adapter.syncNow();
    const second = await again.adapter.syncNow();
    again.adapter.dispose();

    expect(first.failed).toBe(0);
    expect(first.pushed).toBeGreaterThanOrEqual(10);
    expect(second.failed).toBe(0);
    expect(await counts()).toEqual(before);
  });
});
