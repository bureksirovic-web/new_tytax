/**
 * Large restores/imports stay one atomic transaction.
 *
 * Regression: importBackup used to queue outbox rows with one `await` per
 * written row. With sync off that await makes no IndexedDB request, and
 * Dexie drops the transaction zone after 100 consecutive native awaits
 * (ZONE_ECHO_LIMIT), so IndexedDB auto-committed mid-import: the caller got
 * STORAGE (PrematureCommitError) while every row was already written, and a
 * later failure could not roll back. Reproduced at n=100 (99 passed) in
 * fake-indexeddb and in real Chromium. Fix: WriteScope.queueMany.
 */
import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { draft, exercise, freshRepo } from '@/lib/db/__tests__/helpers';
import { exportBackupJson, importLegacy, restoreBackupJson } from '..';
import { syntheticResolver } from '../service/__fixtures__/testing';

function legacyBackup(n: number): string {
  const logs = Array.from({ length: n }, (_, i) =>
    JSON.stringify({
      id: 1717243200000 + i * 1000,
      date: '2024-06-01',
      session: 'A',
      exercises: [{ name: 'TYTAX T1 | Smith Flat Bench Press', sets: [{ kg: 1 + (i % 50), reps: 5, done: true }] }],
    }),
  );
  return `{"logs":[${logs.join(',')}]}`;
}

describe('large imports and restores are one atomic transaction', () => {
  it('restoreBackupJson of a genuine backup with 99, 100 and 250 finished workouts succeeds', async () => {
    for (const n of [99, 100, 250]) {
      const src = freshRepo();
      const p = await src.repo.profiles.create({ name: 'Real user' });
      for (let i = 0; i < n; i++) {
        src.tick(60_000);
        await src.repo.finishWorkout(draft(`w${i}`, p.id, [exercise(`u${i}`, 'bench', [{ kg: 40 + i, reps: 5 }])], { startedAt: src.now().toISOString() }));
      }
      const json = await exportBackupJson(src.repo);
      const prs = (await src.repo.exportBackup()).prRecords.length;
      const dst = freshRepo();
      await expect(restoreBackupJson(dst.repo, json)).resolves.toMatchObject({ skipped: 0 });
      expect(await dst.repo.logs.count(p.id)).toBe(n);
      expect((await dst.repo.exportBackup()).prRecords).toHaveLength(prs);
    }
  }, 120_000);

  it('importLegacy of a legacy file with 99, 100 and 1000 logs succeeds', async () => {
    for (const n of [99, 100, 1000]) {
      const { repo } = freshRepo();
      const run = importLegacy(repo, legacyBackup(n), {
        users: [{ username: 'default', target: { createProfileName: 'a' } }],
        resolver: syntheticResolver(),
      });
      await expect(run).resolves.toMatchObject({ perUser: [{ logs: { inserted: n } }] });
      const left = await repo.exportBackup();
      expect(left.profiles).toHaveLength(1);
      expect(left.workoutLogs).toHaveLength(n);
      expect(left.prRecords.length).toBeGreaterThan(0);
    }
  }, 120_000);

  it('importLegacy is atomic: a failure on user 2 rolls back user 1 (100 logs) completely', async () => {
    const logs = JSON.parse(legacyBackup(100)).logs as unknown[];
    const dump = JSON.stringify({
      tytax_users_list: JSON.stringify(['ana', 'ivo']),
      tytax_logs_ana: JSON.stringify(logs),
      tytax_logs_ivo: JSON.stringify(logs.slice(0, 1)),
    });
    const { repo } = freshRepo();
    const run = importLegacy(repo, dump, {
      users: [
        { username: 'ana', target: { createProfileName: 'Ana' } },
        { username: 'ivo', target: { profileId: 'no-such-profile' } },
      ],
      resolver: syntheticResolver(),
    });
    await expect(run).rejects.toMatchObject({ code: 'NOT_FOUND' });
    // "Any failure leaves the database unchanged."
    const left = await repo.exportBackup();
    expect(left.profiles).toEqual([]);
    expect(left.workoutLogs).toEqual([]);
    expect(left.prRecords).toEqual([]);
  }, 60_000);
});
