import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { exercise, draft, fakeSync, freshRepo, T0 } from './helpers';

describe('sync outbox', () => {
  it('queues nothing without an enabled adapter', async () => {
    const { repo } = freshRepo();
    const p = await repo.profiles.create({ name: 'A' });
    await repo.finishWorkout(draft('w1', p.id, [exercise('u1', 'bench', [{ kg: 60, reps: 5 }])]));
    expect(await repo.outbox.count()).toBe(0);
  });

  it('queues ops in the same transaction and notifies after commit when enabled', async () => {
    const sync = fakeSync();
    const { repo } = freshRepo({ sync });
    const p = await repo.profiles.create({ name: 'A' });
    expect(sync.notifyChanged).toHaveBeenCalledTimes(1);
    const ops = await repo.outbox.peek(10);
    expect(ops).toEqual([
      { id: expect.any(String), table: 'profiles', op: 'upsert', recordId: p.id, profileId: p.id, createdAt: T0.toISOString(), retryCount: 0 },
    ]);

    await repo.finishWorkout(draft('w1', p.id, [exercise('u1', 'bench', [{ kg: 60, reps: 5 }])]));
    expect(sync.notifyChanged).toHaveBeenCalledTimes(2);
    // 1 profile + 1 log + 2 PR records (e1rm, weight baselines) = 4
    expect(await repo.outbox.count()).toBe(4);

    await repo.outbox.fail(ops[0].id, 'network down');
    const failed = (await repo.outbox.peek(1))[0];
    expect(failed.retryCount).toBe(1);
    expect(failed.lastError).toBe('network down');
    await repo.outbox.ack([ops[0].id]);
    expect(await repo.outbox.count()).toBe(3);
  });

  it('transaction(): repo calls inside join it; one notification after commit; a throw rolls all back', async () => {
    const sync = fakeSync();
    const { repo } = freshRepo({ sync });
    await repo.transaction(async () => {
      await repo.profiles.create({ name: 'A' });
      await repo.profiles.create({ name: 'B' });
      expect(sync.notifyChanged).not.toHaveBeenCalled();
    });
    expect(sync.notifyChanged).toHaveBeenCalledTimes(1);
    expect(await repo.profiles.list()).toHaveLength(2);

    await expect(
      repo.transaction(async () => {
        await repo.profiles.create({ name: 'C' });
        throw new Error('abort');
      }),
    ).rejects.toThrow('abort');
    expect(await repo.profiles.list()).toHaveLength(2);
    expect(sync.notifyChanged).toHaveBeenCalledTimes(1);
  });
});

describe('applyRemote (last-write-wins)', () => {
  it('skips older remote rows, applies newer and unknown ones, never queues', async () => {
    const sync = fakeSync();
    const { repo } = freshRepo({ sync });
    const p = await repo.profiles.create({ name: 'Local' });
    const queued = await repo.outbox.count();
    const older = { ...p, name: 'Older', updatedAt: new Date(T0.getTime() - 60_000).toISOString() };
    const newer = { ...p, name: 'Newer', updatedAt: new Date(T0.getTime() + 60_000).toISOString() };
    const fresh = { ...p, id: 'remote-2', name: 'Remote', updatedAt: T0.toISOString() };

    expect(await repo.applyRemote('profiles', [older])).toEqual({ applied: 0, skipped: 1 });
    expect((await repo.profiles.get(p.id))?.name).toBe('Local');
    expect(await repo.applyRemote('profiles', [newer, fresh, { name: 'no id' }])).toEqual({ applied: 2, skipped: 1 });
    expect((await repo.profiles.get(p.id))?.name).toBe('Newer');
    expect((await repo.profiles.get('remote-2'))?.name).toBe('Remote');
    expect(await repo.outbox.count()).toBe(queued);
  });
});

describe('outbox and applyRemote edge cases', () => {
  it('peek is oldest first and honours the limit; ack of unknown ids and fail twice are safe', async () => {
    const sync = fakeSync();
    const { repo, tick } = freshRepo({ sync });
    const a = await repo.profiles.create({ name: 'A' });
    tick();
    await repo.profiles.create({ name: 'B' });
    tick();
    await repo.bodyweight.add(a.id, { date: '2026-03-01', valueKg: 70 });
    const all = await repo.outbox.peek(10);
    expect(all.map((o) => o.table)).toEqual(['profiles', 'profiles', 'bodyweight_entries']);
    expect(await repo.outbox.peek(2)).toEqual(all.slice(0, 2));
    expect(await repo.outbox.peek(0)).toEqual([]);
    await repo.outbox.fail(all[2].id, 'e1');
    await repo.outbox.fail(all[2].id, 'e2');
    await repo.outbox.fail('ghost', 'e3');
    expect((await repo.outbox.peek(10))[2]).toMatchObject({ retryCount: 2, lastError: 'e2' });
    await repo.outbox.ack(['ghost', all[0].id]);
    expect(await repo.outbox.count()).toBe(2);
  });

  it('applies remote tombstones when newer, skips equal timestamps, rejects unknown tables', async () => {
    const { repo } = freshRepo({ sync: fakeSync() });
    const p = await repo.profiles.create({ name: 'A' });
    const e = await repo.bodyweight.add(p.id, { date: '2026-03-01', valueKg: 70 });
    const later = new Date(T0.getTime() + 1000).toISOString();

    expect(await repo.applyRemote('bodyweight_entries', [{ ...e, valueKg: 1 }])).toEqual({ applied: 0, skipped: 1 });
    expect(await repo.applyRemote('bodyweight_entries', [{ ...e, deletedAt: later, updatedAt: later }])).toEqual({ applied: 1, skipped: 0 });
    expect(await repo.bodyweight.list(p.id)).toEqual([]);
    expect((await repo.bodyweight.list(p.id, { includeDeleted: true }))[0].deletedAt).toBe(later);
    expect(await repo.applyRemote('bodyweight_entries', [{ ...e, id: 'r2', updatedAt: 'not a date' }])).toEqual({ applied: 0, skipped: 1 });
    const err = await repo.applyRemote('nope' as 'profiles', []).catch((x: unknown) => x);
    expect((err as { code?: string }).code).toBe('VALIDATION');
  });
});

describe('notifyChanged failures', () => {
  it('an adapter whose notifyChanged throws never breaks a committed write', async () => {
    const sync = fakeSync();
    sync.notifyChanged.mockImplementation(() => {
      throw new Error('adapter down');
    });
    const { repo } = freshRepo({ sync });
    const p = await repo.profiles.create({ name: 'A' });
    expect(sync.notifyChanged).toHaveBeenCalledTimes(1);
    expect((await repo.profiles.get(p.id))?.name).toBe('A');
    expect(await repo.outbox.count()).toBe(1);
  });
});
