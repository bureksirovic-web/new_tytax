/**
 * Review S3-13: a top-level write that commits while an unrelated
 * `repo.transaction` is pending must still notify the sync adapter, even
 * when that transaction later fails. Writes that join the transaction still
 * wait for (and die with) its commit.
 */
import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { fakeSync, freshRepo } from './helpers';

async function setup() {
  const sync = fakeSync();
  const t = freshRepo({ sync });
  const p = await t.repo.profiles.create({ name: 'A' });
  sync.notifyChanged.mockClear();
  return { ...t, sync, p };
}

describe('S3-13 notification of top-level writes vs a failing repo.transaction', () => {
  it('write started first, transaction started second and failing: the write still notifies', async () => {
    const { repo, sync, p } = await setup();
    const write = repo.bodyweight.add(p.id, { date: '2026-03-01', valueKg: 70 });
    const tx = repo.transaction(async () => {
      await repo.notes.set(p.id, 'bench', 'joined');
      throw new Error('abort');
    });
    await write;
    await expect(tx).rejects.toThrow('abort');
    expect(await repo.bodyweight.list(p.id)).toHaveLength(1);
    expect(await repo.notes.get(p.id, 'bench')).toBeUndefined();
    expect(sync.notifyChanged).toHaveBeenCalledTimes(1);
  });

  it('transaction started first and failing, write started second: the write still notifies', async () => {
    const { repo, sync, p } = await setup();
    const tx = repo.transaction(async () => {
      await repo.notes.set(p.id, 'bench', 'joined');
      throw new Error('abort');
    });
    const write = repo.bodyweight.add(p.id, { date: '2026-03-01', valueKg: 70 });
    await expect(tx).rejects.toThrow('abort');
    await write;
    expect(await repo.bodyweight.list(p.id)).toHaveLength(1);
    expect(sync.notifyChanged).toHaveBeenCalledTimes(1);
  });

  it('write committing while a transaction is still running notifies without waiting for it', async () => {
    const { repo, sync, p } = await setup();
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const write = repo.bodyweight.add(p.id, { date: '2026-03-01', valueKg: 70 });
    const tx = repo.transaction(async () => {
      await repo.notes.set(p.id, 'bench', 'joined');
      await gate; // keep the outer transaction open (non-IDB await, see WriteScope docs)
      throw new Error('abort');
    });
    await write;
    expect(sync.notifyChanged).toHaveBeenCalledTimes(1);
    release();
    await expect(tx).rejects.toThrow();
    expect(sync.notifyChanged).toHaveBeenCalledTimes(1);
  });

  it('successful transaction with concurrent top-level write: one notify each, joined writes after commit', async () => {
    const { repo, sync, p } = await setup();
    const write = repo.bodyweight.add(p.id, { date: '2026-03-01', valueKg: 70 });
    const tx = repo.transaction(async () => {
      await repo.notes.set(p.id, 'bench', 'a');
      await repo.transaction(async () => repo.arsenal.add(p.id, 'bench'));
      expect(sync.notifyChanged.mock.calls.length).toBeLessThanOrEqual(1);
    });
    await Promise.all([write, tx]);
    expect(sync.notifyChanged).toHaveBeenCalledTimes(2);
    expect(await repo.outbox.count()).toBe(4);
  });

  it('failing nested transaction inside a failing outer one never notifies', async () => {
    const { repo, sync, p } = await setup();
    await expect(
      repo.transaction(async () => {
        await repo.transaction(async () => repo.arsenal.add(p.id, 'bench'));
        throw new Error('abort');
      }),
    ).rejects.toThrow('abort');
    expect(sync.notifyChanged).not.toHaveBeenCalled();
    expect(await repo.outbox.count()).toBe(1);
  });
});
