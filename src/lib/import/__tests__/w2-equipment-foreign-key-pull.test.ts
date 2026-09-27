/**
 * `equipment` stores one inventory per profile under `id === profileId`
 * (backup-v3/invariants.ts). applyRemote refuses a pulled row keyed with
 * another profile's id, so the device's own backup keeps restoring.
 */
import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { freshRepo } from '@/lib/db/__tests__/helpers';
import { exportBackupJson, restoreBackupJson } from '..';

const LATER = '2030-01-01T00:00:00.000Z';

/** A with an inventory; one pulled row re-keyed onto B's empty inventory slot. */
async function device() {
  const t = freshRepo();
  const a = await t.repo.profiles.create({ name: 'A' });
  const b = await t.repo.profiles.create({ name: 'B' });
  await t.repo.equipment.save(a.id, { kettlebellsKg: [16, 24] });
  const pulled = { ...(await t.repo.equipment.get(a.id)), id: b.id, updatedAt: LATER };
  const res = await t.repo.applyRemote('equipment', [pulled]);
  return { ...t, a, b, res };
}

describe('a pulled equipment row keyed with another profile id', () => {
  it('is refused: A owns no row under B id', async () => {
    const t = await device();
    expect(t.res).toEqual({ applied: 0, skipped: 1 });
    const stored = await t.db.equipment.get(t.b.id);
    expect(stored === undefined || stored.profileId === t.b.id, 'applyRemote stored a row of A under B id').toBe(true);
  });

  it('leaves a device backup that still restores elsewhere', async () => {
    const t = await device();
    const json = await exportBackupJson(t.repo);
    const dst = freshRepo();
    const res = await restoreBackupJson(dst.repo, json);
    expect(res).toMatchObject({ updated: 0, skipped: 0 });
    expect(res.inserted, 'two profiles and A inventory').toBe(3);
  });
});
