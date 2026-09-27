/**
 * Hostile backups: far-future LWW pinning and overwriting an existing profile.
 *
 * Regression: parseBackupV3 accepted any ISO stamp (year 9999 too) and
 * importBackup is LWW on updatedAt, so a backup naming Ana's existing profile
 * id with updatedAt 9999-12-31 overwrote her and could never be undone by her
 * own genuine backup (every genuine row counted as older and was skipped).
 * Now record stamps more than 24 h ahead are clamped to now with an
 * INVALID_VALUE warning, restore reports `existingProfileIds`, and
 * inspectBackupJson lets the UI confirm before merging into a local profile.
 */
import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { draft, exercise, freshRepo } from '@/lib/db/__tests__/helpers';
import { exportBackupJson, inspectBackupJson, restoreBackupJson } from '..';
import { parseBackupV3 } from '../backup-v3';
import type { BackupV3 } from '@/contracts';

const FUTURE = '9999-12-31T23:59:59.999Z';

async function setup() {
  const t = freshRepo();
  const ana = await t.repo.profiles.create({ name: 'Ana' });
  await t.repo.finishWorkout(draft('w-real', ana.id, [exercise('u1', 'bench', [{ kg: 50, reps: 5 }])]));
  const genuine = await exportBackupJson(t.repo, ana.id);
  const hostile = JSON.parse(genuine) as BackupV3;
  const profile = { ...hostile.profiles[0], name: 'owned', updatedAt: FUTURE, settings: { ...hostile.profiles[0].settings, units: 'lb' as const } };
  const real = hostile.workoutLogs[0];
  const injected = { ...real, id: 'w-injected', exercises: real.exercises.map((e) => ({ ...e, uid: 'x1' })), updatedAt: FUTURE };
  const payload: BackupV3 = { ...hostile, profiles: [profile], workoutLogs: [injected], prRecords: [], programs: [], equipment: [] };
  return { t, ana, genuine, payload: JSON.stringify(payload) };
}

describe('restore of a backup with far-future stamps naming an existing profile', () => {
  it('parseBackupV3 clamps createdAt/updatedAt/deletedAt beyond now + 24 h to now, with warnings', async () => {
    const { payload } = await setup();
    const now = new Date('2026-09-26T12:00:00.000Z');
    const { backup, warnings } = parseBackupV3(payload, { now });
    expect(backup.profiles[0].updatedAt).toBe(now.toISOString());
    expect(backup.workoutLogs[0].updatedAt).toBe(now.toISOString());
    const clamped = warnings.filter((w) => w.code === 'INVALID_VALUE' && w.message.includes('future'));
    expect(clamped.map((w) => w.path).sort()).toEqual(['profiles[0].updatedAt', 'workoutLogs[0].updatedAt']);
    // Within the 24 h skew nothing changes.
    const soon = new Date(now.getTime() + 23 * 3600_000).toISOString();
    const near = JSON.parse(payload) as BackupV3;
    near.profiles[0].updatedAt = soon;
    near.workoutLogs[0].updatedAt = soon;
    expect(parseBackupV3(JSON.stringify(near), { now }).backup.profiles[0].updatedAt).toBe(soon);
  });

  it('the hostile stamp is not pinned: the owner can take the profile back', async () => {
    const { t, ana, payload } = await setup();
    const clampAt = t.now();
    // Wave 2 (Unfixed #1): unconfirmed, the restore onto Ana's profile throws CONFLICT and writes nothing.
    await expect(restoreBackupJson(t.repo, payload, { now: clampAt })).rejects.toMatchObject({ code: 'CONFLICT' });
    expect((await t.repo.profiles.get(ana.id))?.name).toBe('Ana');
    const res = await restoreBackupJson(t.repo, payload, { now: clampAt, confirmOverwrite: true });
    expect(res.existingProfileIds).toEqual([ana.id]);
    expect(res.warnings.some((w) => w.path === 'profiles[0].updatedAt')).toBe(true);
    const stored = await t.repo.profiles.get(ana.id);
    expect(stored?.updatedAt.startsWith('9999')).toBe(false);
    // A later local edit wins again under LWW, and so does every later sync.
    t.tick(60_000);
    await t.repo.profiles.update(ana.id, { name: 'Ana' });
    t.tick(60_000);
    const again = await exportBackupJson(t.repo, ana.id);
    const other = freshRepo();
    await restoreBackupJson(other.repo, payload, { now: clampAt });
    await restoreBackupJson(other.repo, again, { now: t.now(), confirmOverwrite: true });
    expect((await other.repo.profiles.get(ana.id))?.name).toBe('Ana');
  });

  it('inspectBackupJson flags profiles that exist locally and writes nothing', async () => {
    const { t, ana, payload } = await setup();
    const before = await t.repo.exportBackup();
    const info = await inspectBackupJson(t.repo, payload);
    expect(info.profiles).toEqual([{ id: ana.id, name: 'owned', existsLocally: true }]);
    expect(info.rows).toBeGreaterThan(0);
    expect(await t.repo.exportBackup()).toEqual(before);
    expect((await inspectBackupJson(freshRepo().repo, payload)).profiles[0].existsLocally).toBe(false);
  });
});
