/** importBackup: tombstoned owners and outbox idempotency (src/lib/db/repo/import-plan.ts). */
import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { fakeSync, freshRepo, seedProfile } from './helpers';

describe('importBackup under a tombstoned profile', () => {
  it('skips child rows whose profile stays tombstoned: not written, not counted, not queued', async () => {
    const t = freshRepo({ sync: fakeSync(true) });
    const id = await seedProfile(t.repo, 'A');
    const backup = await t.repo.exportBackup(id);
    t.tick(1000);
    await t.repo.profiles.remove(id);
    const queued = await t.repo.outbox.count();
    const extra = { ...backup.bodyweightEntries[0], id: 'bw-new', date: '2026-01-01' };

    const res = await t.repo.importBackup({ ...backup, bodyweightEntries: [...backup.bodyweightEntries, extra] });

    expect(res).toEqual({ inserted: 0, updated: 0 });
    expect((await t.db.profiles.get(id))?.deletedAt).toBe(t.now().toISOString());
    expect(await t.db.bodyweightEntries.get('bw-new')).toBeUndefined();
    expect(await t.repo.outbox.count()).toBe(queued);
  });

  it('writes child rows when the backup revives the profile with a newer live row', async () => {
    const t = freshRepo({ sync: fakeSync(true) });
    const id = await seedProfile(t.repo, 'A');
    const backup = await t.repo.exportBackup(id);
    t.tick(1000);
    await t.repo.profiles.remove(id);
    const revived = { ...backup.profiles[0], updatedAt: new Date(t.now().getTime() + 1000).toISOString() };
    const extra = { ...backup.bodyweightEntries[0], id: 'bw-new', date: '2026-01-01' };

    const res = await t.repo.importBackup({ ...backup, profiles: [revived], bodyweightEntries: [extra] });

    expect(res).toEqual({ inserted: 1, updated: 1 });
    expect((await t.db.profiles.get(id))?.deletedAt).toBeUndefined();
    expect((await t.db.bodyweightEntries.get('bw-new'))?.profileId).toBe(id);
  });

  it('restores a tombstoned profile row onto a fresh database without its children', async () => {
    const src = freshRepo({ sync: fakeSync(true) });
    const id = await seedProfile(src.repo, 'A');
    const live = await src.repo.exportBackup(id);
    await src.repo.profiles.remove(id);
    const dead = await src.repo.exportBackup(id);
    const dst = freshRepo();

    expect(await dst.repo.importBackup({ ...dead, bodyweightEntries: [...dead.bodyweightEntries, { ...live.bodyweightEntries[0], id: 'bw-x' }] })).toEqual({ inserted: 1, updated: 0 });
    expect((await dst.db.profiles.get(id))?.deletedAt).toBeDefined();
    expect(await dst.db.bodyweightEntries.count()).toBe(0);
    expect(await dst.db.workoutLogs.count()).toBe(0);
  });
});

describe('importBackup outbox idempotency', () => {
  it('re-importing an identical backup rewrites, queues and counts nothing', async () => {
    const t = freshRepo({ sync: fakeSync(true) });
    const id = await seedProfile(t.repo, 'A');
    const backup = await t.repo.exportBackup(id);
    const queued = await t.repo.outbox.count();
    expect(queued).toBeGreaterThan(0);

    expect(await t.repo.importBackup(backup)).toEqual({ inserted: 0, updated: 0 });
    expect(await t.repo.importBackup(backup)).toEqual({ inserted: 0, updated: 0 });
    expect(await t.repo.outbox.count()).toBe(queued);
  });

  it('an equal updatedAt with different content is still applied, queued once and counted', async () => {
    const t = freshRepo({ sync: fakeSync(true) });
    const id = await seedProfile(t.repo, 'A');
    const backup = await t.repo.exportBackup(id);
    const queued = await t.repo.outbox.count();
    const bw = { ...backup.bodyweightEntries[0], valueKg: 99 };
    const opsFor = async () => (await t.repo.outbox.peek(1000)).filter((o) => o.table === 'bodyweight_entries' && o.recordId === bw.id && o.op === 'upsert').length;
    const before = await opsFor();

    expect(await t.repo.importBackup({ ...backup, bodyweightEntries: [bw] })).toEqual({ inserted: 0, updated: 1 });
    expect((await t.db.bodyweightEntries.get(bw.id))?.valueKg).toBe(99);
    expect(await t.repo.outbox.count()).toBe(queued + 1);
    expect(await opsFor()).toBe(before + 1);
  });
});
