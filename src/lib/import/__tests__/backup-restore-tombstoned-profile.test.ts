/** restoreBackupJson against a profile that is deleted (tombstoned) locally, with sync on. */
import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { fakeSync, freshRepo, T0 } from '@/lib/db/__tests__/helpers';
import { exportBackupJson, restoreBackupJson } from '..';

const DAY = 86_400_000;

async function deletedWithBackup() {
  const t = freshRepo({ sync: fakeSync(true) });
  const p = await t.repo.profiles.create({ name: 'Gone' });
  const backup = JSON.parse(await exportBackupJson(t.repo, p.id)) as Record<string, unknown>;
  t.tick(DAY);
  await t.repo.profiles.remove(p.id);
  const queued = await t.repo.outbox.count();
  return { ...t, p, backup, queued };
}

describe('restoreBackupJson: locally deleted profile', () => {
  it('skips rows owned by the tombstoned profile: nothing live, nothing queued', async () => {
    const t = await deletedWithBackup();
    const stamp = T0.toISOString();
    t.backup.bodyweightEntries = [{ id: 'bw-other-device', profileId: t.p.id, date: '2026-03-01', valueKg: 70, createdAt: stamp, updatedAt: stamp }];
    const res = await restoreBackupJson(t.repo, JSON.stringify(t.backup));
    expect(res).toEqual({ inserted: 0, updated: 0, skipped: 2, warnings: [], existingProfileIds: [] });
    expect((await t.db.profiles.get(t.p.id))?.deletedAt).toBeDefined();
    expect(await t.db.bodyweightEntries.get('bw-other-device')).toBeUndefined();
    expect(await t.repo.outbox.count()).toBe(t.queued);
  });

  it('a pre-deletion backup does not resurrect the profile (the newer tombstone wins)', async () => {
    const t = await deletedWithBackup();
    const res = await restoreBackupJson(t.repo, JSON.stringify(t.backup));
    expect(res).toMatchObject({ inserted: 0, updated: 0 });
    expect((await t.db.profiles.get(t.p.id))?.deletedAt).toBeDefined();
    expect(await t.repo.profiles.list()).toEqual([]);
  });
});
