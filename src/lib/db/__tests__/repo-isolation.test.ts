import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { SEEDED_ROWS, countRows, expectCode, fakeSync, freshRepo, seedProfile, type TestRepo } from './helpers';

async function seedTwo(t: TestRepo = freshRepo()) {
  const a = await seedProfile(t.repo, 'A');
  t.tick();
  const b = await seedProfile(t.repo, 'B');
  return { ...t, a, b };
}

describe('profile isolation', () => {
  it("a call scoped to B never reads A's rows", async () => {
    const { repo, a, b } = await seedTwo();
    const [progA] = await repo.programs.list(a);
    const [bwA] = await repo.bodyweight.list(a);

    expect((await repo.logs.list(b)).map((l) => l.id)).toEqual(['log-B']);
    expect(await repo.logs.get(b, 'log-A')).toBeUndefined();
    expect(await repo.logs.get(b, 'log-A', { includeDeleted: true })).toBeUndefined();
    expect((await repo.logs.historyFor(b, 'bench')).map((l) => l.id)).toEqual(['log-B']);
    expect(await repo.logs.count(b)).toBe(1);
    expect(await repo.programs.get(b, progA.id)).toBeUndefined();
    expect((await repo.programs.list(b)).every((p) => p.profileId === b)).toBe(true);
    expect((await repo.prs.list(b)).map((r) => r.profileId)).toEqual([b, b]);
    expect((await repo.prs.best(b, 'bench')).weight?.profileId).toBe(b);
    expect((await repo.bodyweight.list(b)).some((e) => e.id === bwA.id)).toBe(false);
    expect((await repo.notes.get(b, 'bench'))?.profileId).toBe(b);
    expect((await repo.arsenal.list(b)).every((e) => e.profileId === b)).toBe(true);
    expect((await repo.equipment.get(b)).profileId).toBe(b);
  });

  it("a write scoped to B on A's ids is NOT_FOUND and changes nothing", async () => {
    const { repo, db, a, b } = await seedTwo();
    const [progA] = await repo.programs.list(a);
    const [bwA] = await repo.bodyweight.list(a);
    const before = await countRows(db, a);
    const snapshot = await repo.exportBackup(a);

    await expectCode(repo.logs.update(b, 'log-A', { notes: 'x' }), 'NOT_FOUND');
    await expectCode(repo.logs.softDelete(b, 'log-A'), 'NOT_FOUND');
    await expectCode(repo.logs.restore(b, 'log-A'), 'NOT_FOUND');
    await expectCode(repo.programs.update(b, progA.id, { name: 'mine' }), 'NOT_FOUND');
    await expectCode(repo.programs.softDelete(b, progA.id), 'NOT_FOUND');
    await expectCode(repo.programs.setActive(b, progA.id), 'NOT_FOUND');
    await expectCode(repo.programs.advance(b, progA.id), 'NOT_FOUND');
    await expectCode(repo.bodyweight.update(b, bwA.id, { valueKg: 1 }), 'NOT_FOUND');
    await expectCode(repo.bodyweight.softDelete(b, bwA.id), 'NOT_FOUND');
    // Notes, arsenal and equipment are keyed by (profile, exercise): B's calls touch only B's rows.
    await repo.notes.set(b, 'bench', '');
    await repo.arsenal.remove(b, 'bench');
    await repo.equipment.save(b, { kettlebellsKg: [8] });

    expect(await countRows(db, a)).toEqual(before);
    const after = await repo.exportBackup(a);
    expect({ ...after, exportedAt: '' }).toEqual({ ...snapshot, exportedAt: '' });
    expect(await repo.notes.get(b, 'bench')).toBeUndefined();
    expect((await repo.notes.get(a, 'bench'))?.content).toBe('elbows in');
    expect(await repo.arsenal.has(a, 'bench')).toBe(true);
    expect((await repo.equipment.get(a)).kettlebellsKg).toEqual([16]);
  });
});

describe('profiles.remove', () => {
  it('with sync off, hard-deletes every row of that profile only and re-points the active id', async () => {
    const { repo, db, a, b } = await seedTwo();
    await repo.profiles.setActive(a);
    expect(await countRows(db, a)).toEqual(SEEDED_ROWS);
    expect(await countRows(db, b)).toEqual(SEEDED_ROWS);

    await repo.profiles.remove(a);

    const zero = Object.fromEntries(Object.keys(SEEDED_ROWS).map((k) => [k, 0]));
    expect(await countRows(db, a)).toEqual(zero);
    expect(await countRows(db, b)).toEqual(SEEDED_ROWS);
    expect(await db.profiles.get(a)).toBeUndefined();
    expect(await db.profiles.count()).toBe(1);
    expect(await repo.profiles.getActiveId()).toBe(b);
    expect((await repo.programs.getActive(b))?.profileId).toBe(b);

    await repo.profiles.remove(b);
    expect(await repo.profiles.getActiveId()).toBeNull();
    expect(await db.profiles.count()).toBe(0);
    await expectCode(repo.profiles.remove(b), 'NOT_FOUND');
  });

  it('keeps the active id when a non-active profile is removed', async () => {
    const { repo, a, b } = await seedTwo();
    await repo.profiles.setActive(b);
    await repo.profiles.remove(a);
    expect(await repo.profiles.getActiveId()).toBe(b);
    expect((await repo.profiles.list()).map((p) => p.id)).toEqual([b]);
    expect(await repo.logs.count(b)).toBe(1);
  });

  it('with sync on, tombstones every row, queues one delete per row, and leaves B alone', async () => {
    const sync = fakeSync();
    const t = freshRepo({ sync });
    const { repo, db, a, b } = await seedTwo(t);
    await repo.profiles.setActive(a);
    await repo.outbox.ack((await repo.outbox.peek(1000)).map((o) => o.id));
    sync.notifyChanged.mockClear();
    t.tick(5000);
    const stamp = t.now().toISOString();

    await repo.profiles.remove(a);

    // rows stay as tombstones, so the counts are unchanged but every one is deleted
    expect(await countRows(db, a)).toEqual(SEEDED_ROWS);
    for (const name of Object.keys(SEEDED_ROWS)) {
      const rows = await db.table(name).where('profileId').equals(a).toArray();
      expect(rows.every((r: { deletedAt?: string }) => r.deletedAt === stamp)).toBe(true);
    }
    expect((await db.profiles.get(a))?.deletedAt).toBe(stamp);
    const ops = await repo.outbox.peek(1000);
    // 1+1+2+2+1+2+1 = 10 owned rows + the profile = 11 delete ops, all for A
    expect(ops).toHaveLength(11);
    expect(ops.every((o) => o.op === 'delete' && o.profileId === a)).toBe(true);
    expect(sync.notifyChanged).toHaveBeenCalledTimes(1);
    expect((await db.table('workoutLogs').where('profileId').equals(b).toArray()).every((r: { deletedAt?: string }) => !r.deletedAt)).toBe(true);
    expect(await repo.profiles.getActiveId()).toBe(b);
    expect((await repo.profiles.list({ includeDeleted: true })).map((p) => p.id)).toEqual([a, b]);
  });

  it('with sync off, drops the removed profile’s queued outbox rows only', async () => {
    const { repo, db } = freshRepo();
    const a = await repo.profiles.create({ name: 'A' });
    const b = await repo.profiles.create({ name: 'B' });
    const op = (id: string, profileId: string) => ({ id, table: 'profiles' as const, op: 'upsert' as const, recordId: profileId, profileId, createdAt: '2026-03-01T00:00:00.000Z', retryCount: 0 });
    await db.syncQueue.bulkAdd([op('q-a', a.id), op('q-b', b.id)]);
    await repo.profiles.remove(a.id);
    expect((await db.syncQueue.toArray()).map((o) => o.id)).toEqual(['q-b']);
    expect(await repo.outbox.count()).toBe(1);
  });
});
