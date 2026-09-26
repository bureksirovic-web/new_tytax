/**
 * Wave 2 item 9 (G2 unfixed #1, hostile restore overwrite): inspectBackupJson
 * reports per-profile conflicts, and restoreBackupJson refuses (RepoError
 * CONFLICT, nothing written) until the caller passes `confirmOverwrite: true`.
 */
import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { isRepoError, type BackupV3 } from '@/contracts';
import { freshRepo, T0 } from '@/lib/db/__tests__/helpers';
import { exportBackupJson, inspectBackupJson, restoreBackupJson } from '..';

const LATER = new Date(T0.getTime() + 3600_000).toISOString();
const ZERO = { local: 0, incoming: 0 };

/** Ana with 2 bodyweight entries and 1 note; `file` is her own backup. */
async function device() {
  const t = freshRepo();
  const ana = await t.repo.profiles.create({ name: 'Ana' });
  await t.repo.bodyweight.add(ana.id, { date: '2026-03-01', valueKg: 70 });
  await t.repo.bodyweight.add(ana.id, { date: '2026-03-02', valueKg: 69.5 });
  await t.repo.notes.set(ana.id, 'bench', 'elbows in');
  const file = await exportBackupJson(t.repo, ana.id);
  return { t, ana, file, edit: (fn: (b: BackupV3) => void) => { const b = JSON.parse(file) as BackupV3; fn(b); return JSON.stringify(b); } };
}

async function rejectsConflict(p: Promise<unknown>): Promise<void> {
  const err = await p.then(() => undefined, (e: unknown) => e);
  expect(isRepoError(err, 'CONFLICT'), String(err)).toBe(true);
}

describe('inspectBackupJson conflicts', () => {
  it('a fresh device has no conflicts and restores without confirmation', async () => {
    const { file } = await device();
    const dst = freshRepo();
    const info = await inspectBackupJson(dst.repo, file);
    expect(info.conflicts).toEqual([]);
    expect(info.requiresConfirmation).toBe(false);
    // 1 profile + 2 bodyweight + 1 note = 4 rows inserted
    expect(await restoreBackupJson(dst.repo, file)).toMatchObject({ inserted: 4, updated: 0 });
  });

  it('re-restoring the device\'s own current backup is a no-op that needs no confirmation', async () => {
    const { t, ana, file } = await device();
    const info = await inspectBackupJson(t.repo, file);
    expect(info.conflicts).toEqual([
      {
        profileId: ana.id,
        localName: 'Ana',
        backupName: 'Ana',
        localUpdatedAt: ana.updatedAt,
        backupUpdatedAt: ana.updatedAt,
        wouldOverwrite: false,
        wouldAdd: false,
        rowCountsByTable: {
          workoutLogs: ZERO,
          programs: ZERO,
          prRecords: ZERO,
          bodyweightEntries: { local: 2, incoming: 2 },
          exerciseNotes: { local: 1, incoming: 1 },
          arsenal: ZERO,
          equipment: ZERO,
        },
      },
    ]);
    expect(info.requiresConfirmation).toBe(false);
    expect(await restoreBackupJson(t.repo, file)).toMatchObject({ inserted: 0, updated: 0, skipped: 4 });
  });

  it('a newer renamed profile with a foreign row: overwrite + add, restore refused until confirmed', async () => {
    const { t, ana, edit } = await device();
    const hostile = edit((b) => {
      b.profiles[0] = { ...b.profiles[0], name: 'owned', updatedAt: LATER };
      b.bodyweightEntries.push({ id: 'bw-foreign', profileId: ana.id, date: '2026-02-01', valueKg: 99, createdAt: LATER, updatedAt: LATER });
    });
    const info = await inspectBackupJson(t.repo, hostile);
    expect(info.conflicts[0]).toMatchObject({ localName: 'Ana', backupName: 'owned', backupUpdatedAt: LATER, wouldOverwrite: true, wouldAdd: true });
    // local 2 bodyweight rows; the file has those 2 plus bw-foreign = 3
    expect(info.conflicts[0].rowCountsByTable.bodyweightEntries).toEqual({ local: 2, incoming: 3 });
    expect(info.requiresConfirmation).toBe(true);

    const before = await t.repo.exportBackup();
    await rejectsConflict(restoreBackupJson(t.repo, hostile));
    expect(await t.repo.exportBackup()).toEqual(before);

    // confirmed: profile row updated (1) + bw-foreign inserted (1)
    expect(await restoreBackupJson(t.repo, hostile, { confirmOverwrite: true })).toMatchObject({ inserted: 1, updated: 1, existingProfileIds: [ana.id] });
    expect((await t.repo.profiles.get(ana.id))?.name).toBe('owned');
  });

  it('only adding rows to an existing profile still requires confirmation', async () => {
    const { t, ana, edit } = await device();
    const extra = edit((b) => {
      b.bodyweightEntries.push({ id: 'bw-other-phone', profileId: ana.id, date: '2026-02-20', valueKg: 71, createdAt: LATER, updatedAt: LATER });
    });
    const info = await inspectBackupJson(t.repo, extra);
    expect(info.conflicts[0]).toMatchObject({ wouldOverwrite: false, wouldAdd: true });
    expect(info.requiresConfirmation).toBe(true);
    await rejectsConflict(restoreBackupJson(t.repo, extra, { confirmOverwrite: false }));
    expect(await t.repo.bodyweight.list(ana.id)).toHaveLength(2);
  });

  it('an older backup of a profile edited since (local wins everywhere) needs no confirmation', async () => {
    const { t, ana, file } = await device();
    t.tick(60_000);
    await t.repo.profiles.update(ana.id, { name: 'Ana B.' });
    const info = await inspectBackupJson(t.repo, file);
    expect(info.conflicts[0]).toMatchObject({ localName: 'Ana B.', backupName: 'Ana', wouldOverwrite: false, wouldAdd: false });
    expect(info.requiresConfirmation).toBe(false);
    await restoreBackupJson(t.repo, file);
    expect((await t.repo.profiles.get(ana.id))?.name).toBe('Ana B.');
  });

  it('a tombstone for a row this device never had is not an addition', async () => {
    const { t, ana, edit } = await device();
    const ghost = edit((b) => {
      b.bodyweightEntries.push({ id: 'bw-gone', profileId: ana.id, date: '2026-01-01', valueKg: 80, createdAt: T0.toISOString(), updatedAt: T0.toISOString(), deletedAt: T0.toISOString() });
    });
    const info = await inspectBackupJson(t.repo, ghost);
    expect(info.conflicts[0]).toMatchObject({ wouldOverwrite: false, wouldAdd: false });
    // tombstones are not counted as live incoming rows: still 2
    expect(info.conflicts[0].rowCountsByTable.bodyweightEntries).toEqual({ local: 2, incoming: 2 });
  });

  it('a different note id for an exercise that already has a live note counts as an overwrite', async () => {
    const { t, ana, edit } = await device();
    const clash = edit((b) => {
      b.exerciseNotes = [{ id: 'note-other-phone', profileId: ana.id, exerciseId: 'bench', content: 'flare', createdAt: LATER, updatedAt: LATER }];
    });
    const info = await inspectBackupJson(t.repo, clash);
    expect(info.conflicts[0]).toMatchObject({ wouldOverwrite: true, wouldAdd: false });
    expect(info.requiresConfirmation).toBe(true);
  });

  it('a profile deleted on this device is not a conflict', async () => {
    const { t, ana, file } = await device();
    await t.repo.profiles.remove(ana.id);
    const info = await inspectBackupJson(t.repo, file);
    expect(info.conflicts).toEqual([]);
    expect(info.requiresConfirmation).toBe(false);
  });
});
