/** The rest of src/lib/db/repo/transfer.ts: applyRemote (LWW), the outbox and resetAll. */
import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { isRepoError, type SyncTable } from '@/contracts';
import { fakeSync, freshRepo } from '@/lib/db/__tests__/helpers';

describe('applyRemote', () => {
  it('rejects an unknown table and skips rows without id or a parseable updatedAt', async () => {
    const { repo } = freshRepo();
    const p = await repo.profiles.create({ name: 'A' });
    await expect(repo.applyRemote('nope' as SyncTable, [])).rejects.toSatisfy((e: unknown) => isRepoError(e, 'VALIDATION'));
    const later = new Date(Date.parse(p.updatedAt) + 1000).toISOString();
    const rows = [{ ...p, name: 'bad time', updatedAt: 'x' }, { id: '', updatedAt: later }, { ...p, name: 'tie' }, { ...p, name: 'win', updatedAt: later }];
    expect(await repo.applyRemote('profiles', rows)).toEqual({ applied: 1, skipped: 3 });
    expect((await repo.profiles.get(p.id))?.name).toBe('win');
  });

  it('a local row with an unparseable updatedAt loses to any valid remote row', async () => {
    const { repo, db } = freshRepo();
    const p = await repo.profiles.create({ name: 'A' });
    await db.profiles.put({ ...p, name: 'broken', updatedAt: 'garbage' });
    // importBackup: a valid incoming row also beats it (restore path, same rule).
    const backup = await repo.exportBackup(p.id);
    expect(await repo.importBackup({ ...backup, profiles: [{ ...p, name: 'restored' }] })).toEqual({ inserted: 0, updated: 1 });
    await db.profiles.put({ ...p, name: 'broken', updatedAt: 'garbage' });
    expect(await repo.applyRemote('profiles', [{ ...p, name: 'remote' }])).toEqual({ applied: 1, skipped: 0 });
    expect((await repo.profiles.get(p.id))?.name).toBe('remote');
  });
});

describe('outbox and resetAll', () => {
  it('peeks oldest first, records failures and acks', async () => {
    const t = freshRepo({ sync: fakeSync() });
    await t.repo.profiles.create({ name: 'A' });
    t.tick();
    await t.repo.profiles.create({ name: 'B' });
    const ops = await t.repo.outbox.peek(10);
    expect(ops).toHaveLength(2);
    expect(ops[0].createdAt < ops[1].createdAt).toBe(true);
    expect(await t.repo.outbox.peek(-3)).toEqual([]);
    await t.repo.outbox.fail(ops[0].id, 'offline');
    await t.repo.outbox.fail(ops[0].id, 'still offline');
    expect((await t.repo.outbox.peek(1))[0]).toMatchObject({ retryCount: 2, lastError: 'still offline' });
    await t.repo.outbox.ack([ops[0].id]);
    expect(await t.repo.outbox.count()).toBe(1);
  });

  it('resetAll empties every table', async () => {
    const { repo, db } = freshRepo({ sync: fakeSync() });
    const p = await repo.profiles.ensureActive('A');
    await repo.bodyweight.add(p.id, { date: '2026-03-01', valueKg: 70 });
    await repo.resetAll();
    const counts = await Promise.all(db.tables.map((table) => table.count()));
    expect(counts.every((n) => n === 0)).toBe(true);
  });
});
