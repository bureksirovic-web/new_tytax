/**
 * Wave 2 G2 item 1 (S2, G4-26 / G4-47): logs.update, softDelete and restore
 * re-derive set isPR/e1rm, prCount and PR rows of the edited log and every
 * later live log, in one transaction, queueing sync ops for changed rows only.
 *
 * Hand-derived values (Brzycki e1RM = kg x 36 / (37 - reps); 5 reps -> kg x 1.125;
 * detectPRs rounds to 0.01 kg):
 *   A 100x5: e1rm 112.5, weight 100   -> first ever: baselines (stored, prCount 0)
 *   B 110x5: e1rm 123.75, weight 110  -> both beat A: prCount 2
 *   C 105x5: e1rm 118.125 -> 118.13, weight 105 -> below B: prCount 0
 * Edit B to 90x5 (e1rm 101.25, weight 90): B beats nothing (prCount 0, its 2 rows
 * tombstoned); C now beats A (118.13 > 112.5, 105 > 100): prCount 2, 2 new rows.
 * (prCount counts PR types, so "C becomes PR" is 2: e1rm + weight.)
 */
import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { fakeSync, draft, exercise, freshRepo, type TestRepo } from './helpers';

const DAY = 86_400_000;

async function finish(t: TestRepo, id: string, profileId: string, kg: number, reps = 5) {
  t.tick(DAY);
  return t.repo.finishWorkout(draft(id, profileId, [exercise(`u-${id}`, 'bench', [{ kg, reps }])], { startedAt: t.now().toISOString() }));
}

async function setKg(t: TestRepo, profileId: string, id: string, kg: number) {
  const log = await t.repo.logs.get(profileId, id);
  if (!log) throw new Error(`missing ${id}`);
  t.tick();
  return t.repo.logs.update(profileId, id, { exercises: log.exercises.map((ex) => ({ ...ex, sets: ex.sets.map((s) => ({ ...s, kg })) })) });
}

async function abc(sync = fakeSync(false)) {
  const t = freshRepo({ sync });
  const p = await t.repo.profiles.create({ name: 'A' });
  await finish(t, 'A', p.id, 100);
  await finish(t, 'B', p.id, 110);
  await finish(t, 'C', p.id, 105);
  return { t, pid: p.id };
}

const prCount = async (t: TestRepo, pid: string, id: string) => (await t.repo.logs.get(pid, id))?.prCount;

describe('W2 item 1: an edit re-derives every later log', () => {
  it('A, B, C as finished: B holds both PRs, C none', async () => {
    const { t, pid } = await abc();
    expect([await prCount(t, pid, 'A'), await prCount(t, pid, 'B'), await prCount(t, pid, 'C')]).toEqual([0, 2, 0]);
    const best = await t.repo.prs.best(pid, 'bench');
    expect([best.weight?.workoutLogId, best.weight?.value, best.e1rm?.value]).toEqual(['B', 110, 123.75]);
  });

  it('editing B to 90x5 moves both PRs to C', async () => {
    const { t, pid } = await abc();
    const b = await setKg(t, pid, 'B', 90);
    expect(b.prCount).toBe(0);
    expect(b.exercises[0].sets[0].isPR).toBeUndefined();
    expect(b.exercises[0].sets[0].e1rm).toBe(101.25);
    const c = await t.repo.logs.get(pid, 'C');
    expect(c?.prCount).toBe(2);
    expect(c?.exercises[0].sets[0].isPR).toBe(true);
    expect(c?.updatedAt).toBe(t.now().toISOString());
    const best = await t.repo.prs.best(pid, 'bench');
    expect([best.weight?.workoutLogId, best.weight?.value]).toEqual(['C', 105]);
    expect([best.e1rm?.workoutLogId, best.e1rm?.value]).toEqual(['C', 118.13]);
    // Live rows: A's 2 baselines + C's 2 PRs; B's 2 are tombstones.
    const rows = await t.repo.prs.list(pid, { includeDeleted: true });
    expect(rows.filter((r) => !r.deletedAt).map((r) => r.workoutLogId).sort()).toEqual(['A', 'A', 'C', 'C']);
    expect(rows.filter((r) => r.deletedAt).map((r) => r.workoutLogId)).toEqual(['B', 'B']);
  });

  it('A is untouched by an edit of B', async () => {
    const { t, pid } = await abc();
    const before = await t.repo.logs.get(pid, 'A');
    await setKg(t, pid, 'B', 90);
    expect(await t.repo.logs.get(pid, 'A')).toStrictEqual(before);
  });

  it('deleting C (after the edit) leaves no later PR; restoring brings C back', async () => {
    const { t, pid } = await abc();
    await setKg(t, pid, 'B', 90);
    await t.repo.logs.softDelete(pid, 'C');
    // Remaining live: A 100 (baseline), B 90 (no PR).
    let best = await t.repo.prs.best(pid, 'bench');
    expect([best.weight?.workoutLogId, best.weight?.value, best.e1rm?.value]).toEqual(['A', 100, 112.5]);
    expect(await prCount(t, pid, 'B')).toBe(0);
    await t.repo.logs.restore(pid, 'C');
    best = await t.repo.prs.best(pid, 'bench');
    expect([best.weight?.workoutLogId, best.weight?.value, best.e1rm?.value]).toEqual(['C', 105, 118.13]);
    expect(await prCount(t, pid, 'C')).toBe(2);
  });

  it('deleting the PR log B lets C take the PR; restoring B takes it back', async () => {
    const { t, pid } = await abc();
    await t.repo.logs.softDelete(pid, 'B');
    // Live: A 100, C 105 -> C beats A: prCount 2.
    expect(await prCount(t, pid, 'C')).toBe(2);
    expect((await t.repo.prs.best(pid, 'bench')).weight?.workoutLogId).toBe('C');
    await t.repo.logs.restore(pid, 'B');
    // B 110 back before C: C 105 < 110 -> prCount 0, C's rows tombstoned.
    expect(await prCount(t, pid, 'C')).toBe(0);
    const best = await t.repo.prs.best(pid, 'bench');
    expect([best.weight?.workoutLogId, best.weight?.value, best.e1rm?.value]).toEqual(['B', 110, 123.75]);
    const liveC = (await t.repo.prs.list(pid)).filter((r) => r.workoutLogId === 'C');
    expect(liveC).toEqual([]);
  });

  it('a date edit that moves B after C re-derives both (C is now the PR, B beats C)', async () => {
    const { t, pid } = await abc();
    const c = await t.repo.logs.get(pid, 'C');
    const later = new Date(Date.parse(c?.startedAt ?? '') + DAY);
    const day = `${later.getFullYear()}-${String(later.getMonth() + 1).padStart(2, '0')}-${String(later.getDate()).padStart(2, '0')}`;
    t.tick();
    await t.repo.logs.update(pid, 'B', { date: day, startedAt: later.toISOString() });
    // Order A 100, C 105, B 110: C beats A (2), B beats C (2).
    expect([await prCount(t, pid, 'C'), await prCount(t, pid, 'B')]).toEqual([2, 2]);
    expect((await t.repo.prs.best(pid, 'bench')).weight?.workoutLogId).toBe('B');
  });

  it('queues sync ops for the changed rows only', async () => {
    const sync = fakeSync(true);
    const { t, pid } = await abc(sync);
    const before = await t.repo.outbox.count();
    await setKg(t, pid, 'B', 90);
    const ops = (await t.repo.outbox.peek(100)).slice(before);
    // B upsert, C upsert (re-annotated), B's 2 rows deleted, C's 2 rows inserted; A untouched.
    const logOps = ops.filter((o) => o.table === 'workout_logs').map((o) => `${o.op}:${o.recordId}`).sort();
    expect(logOps).toEqual(['upsert:B', 'upsert:C']);
    const prOps = ops.filter((o) => o.table === 'pr_records').map((o) => o.op).sort();
    expect(prOps).toEqual(['delete', 'delete', 'upsert', 'upsert']);
    expect(ops).toHaveLength(6);
  });

  it('an edit that changes nothing PR-wise queues only the edited log', async () => {
    const sync = fakeSync(true);
    const { t, pid } = await abc(sync);
    const before = await t.repo.outbox.count();
    await setKg(t, pid, 'C', 104);
    // C 104x5 (e1rm 117) < B 110x5 (123.75): still prCount 0, no rows wanted, none stored.
    const ops = (await t.repo.outbox.peek(100)).slice(before);
    expect(ops.map((o) => `${o.table}:${o.op}:${o.recordId}`)).toEqual(['workout_logs:upsert:C']);
    expect(await prCount(t, pid, 'C')).toBe(0);
  });
});
