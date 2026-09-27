/**
 * Request G5-05: a backup file never carries the sync account id, and a
 * restore never changes which account owns a profile.
 */
import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { freshRepo } from '@/lib/db/__tests__/helpers';
import { exportBackupJson, inspectBackupJson, restoreBackupJson } from '..';

describe('backup and the sync account id (G5-05)', () => {
  it('exportBackupJson omits accountId from every profile', async () => {
    const t = freshRepo();
    const p = await t.repo.profiles.create({ name: 'A' });
    await t.repo.profiles.update(p.id, { accountId: 'account-a' });
    expect((await t.repo.profiles.get(p.id))?.accountId).toBe('account-a');

    const text = await exportBackupJson(t.repo);
    const file = JSON.parse(text) as { profiles: Record<string, unknown>[] };
    expect(file.profiles.map((x) => x.id)).toEqual([p.id]);
    expect(file.profiles.every((x) => !('accountId' in x))).toBe(true);
    expect(text).not.toContain('account-a');
  });

  it('an older file that carries accountId restores the profile without it on a new device', async () => {
    const a = freshRepo();
    const p = await a.repo.profiles.create({ name: 'A' });
    await a.repo.profiles.update(p.id, { accountId: 'account-a' });
    // What pre-G5-05 exports wrote: repo.exportBackup keeps accountId (the sync push needs it).
    const legacyText = JSON.stringify(await a.repo.exportBackup());
    expect(legacyText).toContain('account-a');

    const c = freshRepo();
    const result = await restoreBackupJson(c.repo, legacyText);
    expect(result.inserted).toBeGreaterThan(0);
    const restored = await c.repo.profiles.get(p.id);
    expect(restored?.name).toBe('A');
    expect(restored?.accountId).toBeUndefined();
  });

  it('restoring your own backup keeps the local owner and writes nothing', async () => {
    const t = freshRepo();
    const p = await t.repo.profiles.create({ name: 'A' });
    await t.repo.profiles.update(p.id, { accountId: 'account-a' });
    const text = await exportBackupJson(t.repo);

    const inspection = await inspectBackupJson(t.repo, text);
    expect(inspection.requiresConfirmation).toBe(false);
    const result = await restoreBackupJson(t.repo, text);
    expect({ inserted: result.inserted, updated: result.updated }).toEqual({ inserted: 0, updated: 0 });
    expect((await t.repo.profiles.get(p.id))?.accountId).toBe('account-a');
  });
});
