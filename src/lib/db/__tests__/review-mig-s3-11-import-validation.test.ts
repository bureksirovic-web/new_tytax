/**
 * Review S3-11: importBackup must validate every table's rows (not only id /
 * profileId) before any write, and applyRemote must not store malformed rows.
 */
import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import type { BackupV3 } from '@/contracts/repo';
import { draft, exercise, expectCode, freshRepo, seedProfile } from './helpers';

async function seeded() {
  const t = freshRepo();
  const pid = await seedProfile(t.repo, 'A');
  await t.repo.finishWorkout(draft('w-1', pid, [exercise('e1', 'bench', [{ kg: 60, reps: 5 }])]));
  const backup = await t.repo.exportBackup(pid);
  return { t, pid, backup };
}

async function snapshotCounts(t: ReturnType<typeof freshRepo>): Promise<number[]> {
  return Promise.all(t.db.tables.map((tb) => tb.count()));
}

type Mutate = (b: BackupV3, pid: string) => BackupV3;
const bad: Array<[string, Mutate]> = [
  ['workoutLogs without exercises/date', (b, pid) => ({ ...b, workoutLogs: [...b.workoutLogs, { id: 'x', profileId: pid } as unknown as BackupV3['workoutLogs'][number]] })],
  ['workoutLogs with exercises not an array', (b) => ({ ...b, workoutLogs: [{ ...b.workoutLogs[0], id: 'x2', exercises: 'no' } as unknown as BackupV3['workoutLogs'][number]] })],
  ['programs without sessions', (b, pid) => ({ ...b, programs: [{ id: 'p', profileId: pid } as unknown as BackupV3['programs'][number]] })],
  ['prRecords with string kg', (b, pid) => ({ ...b, prRecords: [{ id: 'pr', profileId: pid, kg: 'heavy' } as unknown as BackupV3['prRecords'][number]] })],
  ['bodyweightEntries without date', (b, pid) => ({ ...b, bodyweightEntries: [{ id: 'bw', profileId: pid, weightKg: 80 } as unknown as BackupV3['bodyweightEntries'][number]] })],
  ['exerciseNotes without exerciseId', (b, pid) => ({ ...b, exerciseNotes: [{ id: 'n', profileId: pid } as unknown as BackupV3['exerciseNotes'][number]] })],
  ['arsenal without exerciseId', (b, pid) => ({ ...b, arsenal: [{ id: 'a', profileId: pid } as unknown as BackupV3['arsenal'][number]] })],
  ['equipment without items', (b, pid) => ({ ...b, equipment: [{ id: 'eq', profileId: pid } as unknown as BackupV3['equipment'][number]] })],
  ['profiles without settings', (b) => ({ ...b, profiles: [{ ...b.profiles[0], settings: undefined } as unknown as BackupV3['profiles'][number]] })],
];

describe('S3-11: repo.importBackup validates every table before any write', () => {
  it.each(bad)('%s -> VALIDATION, nothing written', async (_label, mutate) => {
    const { t, pid, backup } = await seeded();
    const before = await snapshotCounts(t);
    await expectCode(t.repo.importBackup(mutate(backup, pid)), 'VALIDATION');
    expect(await snapshotCounts(t)).toEqual(before);
  });

  it('a valid exported backup still imports (round trip into a fresh db)', async () => {
    const { backup } = await seeded();
    const dst = freshRepo();
    const res = await dst.repo.importBackup(backup);
    expect(res.inserted).toBeGreaterThan(0);
  });

  it('a malformed log mixed with a valid new profile writes nothing', async () => {
    const { backup, pid } = await seeded();
    const dst = freshRepo();
    const mutated = bad[0][1](backup, pid);
    await expectCode(dst.repo.importBackup(mutated), 'VALIDATION');
    expect(await dst.db.profiles.count()).toBe(0);
    expect(await dst.db.workoutLogs.count()).toBe(0);
  });
});

describe('S3-11: applyRemote skips malformed rows', () => {
  it('workout_logs row without exercises/date is skipped, not stored', async () => {
    const { t, pid } = await seeded();
    const stamp = new Date(t.now().getTime() + 1000).toISOString();
    const res = await t.repo.applyRemote('workout_logs', [
      { id: 'r-1', profileId: pid, updatedAt: stamp },
      { id: 'r-2', profileId: pid, updatedAt: stamp, date: '2026-03-01', exercises: 'x' },
    ]);
    expect(res).toEqual({ applied: 0, skipped: 2 });
    expect(await t.db.workoutLogs.get('r-1')).toBeUndefined();
    expect(await t.db.workoutLogs.get('r-2')).toBeUndefined();
    await expect(t.repo.logs.historyFor(pid, 'bench')).resolves.toBeDefined();
  });

  it.each([
    ['programs', { name: 'P' }],
    ['pr_records', { kg: 'heavy' }],
    ['bodyweight_entries', { weightKg: 80 }],
    ['exercise_notes', { note: 'x' }],
    ['arsenal', {}],
    ['equipment', {}],
    ['profiles', { name: 'no settings' }],
  ] as const)('%s malformed row is skipped', async (table, extra) => {
    const { t, pid } = await seeded();
    const stamp = new Date(t.now().getTime() + 1000).toISOString();
    const row = table === 'profiles' ? { id: 'rp', updatedAt: stamp, ...extra } : { id: 'rx', profileId: pid, updatedAt: stamp, ...extra };
    const res = await t.repo.applyRemote(table, [row]);
    expect(res).toEqual({ applied: 0, skipped: 1 });
  });

  it('a full pulled log with SQL NULL on optional columns is applied', async () => {
    const { t, pid, backup } = await seeded();
    const stamp = new Date(t.now().getTime() + 1000).toISOString();
    const row = { ...backup.workoutLogs[0], id: 'r-ok', updatedAt: stamp, deletedAt: null, notes: null };
    expect(await t.repo.applyRemote('workout_logs', [row])).toEqual({ applied: 1, skipped: 0 });
    expect((await t.repo.logs.get(pid, 'r-ok'))?.id).toBe('r-ok');
  });
});
