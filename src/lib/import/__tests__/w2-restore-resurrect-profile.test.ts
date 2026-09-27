/**
 * Restore over a profile deleted (tombstoned) on this device. Refuter finding
 * (Wave 2): repo.profiles.get hides tombstones, so a file whose profile row is
 * newer than the local deletion resurrected the profile and its history
 * without `confirmOverwrite`. Now inspect reports `resurrectsProfileIds` and
 * the restore refuses (CONFLICT) until confirmed. A far-future file is clamped
 * and never beats the tombstone (w2-restore-clamped-pin).
 */
import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { isRepoError, type BackupV3 } from '@/contracts';
import { draft, exercise, fakeSync, freshRepo, T0 } from '@/lib/db/__tests__/helpers';
import { exportBackupJson, inspectBackupJson, restoreBackupJson } from '..';

const DAY = 86_400_000;
/** Ana's data is stamped T0; she is deleted at T0+1d; her other phone edited at T0+1.5d; restore at T0+2d. */
const DELETED_AT = new Date(T0.getTime() + DAY).toISOString();
const OTHER_PHONE = new Date(T0.getTime() + 1.5 * DAY).toISOString();
const FUTURE = '9999-12-31T23:59:59.999Z';
const RESTORE_NOW = new Date(T0.getTime() + 2 * DAY);

async function device() {
  const t = freshRepo({ sync: fakeSync(true) });
  const ana = await t.repo.profiles.create({ name: 'Ana' });
  await t.repo.finishWorkout(draft('w1', ana.id, [exercise('u1', 'bench', [{ kg: 50, reps: 5 }])]));
  await t.repo.bodyweight.add(ana.id, { date: '2026-03-01', valueKg: 70 });
  const file = JSON.parse(await exportBackupJson(t.repo, ana.id)) as BackupV3;
  t.tick(DAY);
  await t.repo.profiles.remove(ana.id);
  expect((await t.db.workoutLogs.get('w1'))?.deletedAt).toBe(DELETED_AT);
  const restamp = (stamp: string): string => {
    const bump = <T extends { updatedAt: string }>(rows: T[]): T[] => rows.map((r) => ({ ...r, updatedAt: stamp }));
    return JSON.stringify({ ...file, profiles: bump(file.profiles), workoutLogs: bump(file.workoutLogs), bodyweightEntries: bump(file.bodyweightEntries) });
  };
  return { ...t, ana, newer: restamp(OTHER_PHONE), hostile: restamp(FUTURE), ops: await t.repo.outbox.count() };
}

describe('restore of a newer backup over a locally deleted profile', () => {
  it('inspectBackupJson asks for confirmation to bring the profile back', async () => {
    const t = await device();
    const info = await inspectBackupJson(t.repo, t.newer, { now: RESTORE_NOW });
    expect(info.conflicts, 'conflicts list live local profiles only').toEqual([]);
    expect(info.profiles[0]).toMatchObject({ id: t.ana.id, existsLocally: false });
    expect(info.resurrectsProfileIds).toEqual([t.ana.id]);
    expect(info.requiresConfirmation).toBe(true);
  });

  it('restoreBackupJson refuses without confirmOverwrite and writes nothing', async () => {
    const t = await device();
    const before = await t.repo.exportBackup();
    const err = await restoreBackupJson(t.repo, t.newer, { now: RESTORE_NOW }).then(
      () => undefined,
      (e: unknown) => e,
    );
    expect(isRepoError(err, 'CONFLICT'), `expected CONFLICT, got ${String(err)}`).toBe(true);
    expect(await t.repo.profiles.get(t.ana.id)).toBeUndefined();
    expect((await t.db.workoutLogs.get('w1'))?.deletedAt).toBe(DELETED_AT);
    expect(await t.repo.exportBackup()).toEqual(before);
    expect(await t.repo.outbox.count()).toBe(t.ops);
  });

  it('once confirmed, the profile and its history come back', async () => {
    const t = await device();
    const res = await restoreBackupJson(t.repo, t.newer, { now: RESTORE_NOW, confirmOverwrite: true });
    expect(res.inserted + res.updated).toBeGreaterThan(0);
    expect((await t.repo.profiles.get(t.ana.id))?.name).toBe('Ana');
    expect((await t.repo.logs.list(t.ana.id)).map((l) => l.id)).toEqual(['w1']);
  });

  it('a far-future file is clamped and cannot beat the tombstone: nothing to confirm, nothing written', async () => {
    const t = await device();
    const info = await inspectBackupJson(t.repo, t.hostile, { now: RESTORE_NOW });
    expect(info.resurrectsProfileIds).toEqual([]);
    expect(info.requiresConfirmation).toBe(false);
    const res = await restoreBackupJson(t.repo, t.hostile, { now: RESTORE_NOW });
    expect(res).toMatchObject({ inserted: 0, updated: 0, existingProfileIds: [] });
    expect(await t.repo.profiles.get(t.ana.id)).toBeUndefined();
    expect(await t.repo.outbox.count()).toBe(t.ops);
  });
});
