/**
 * Wave 2 G2 item 2 (S2, G3-02) at the service level: importLegacy and
 * restoreBackupJson leave PR rows derived from the imported history, so the
 * first real PR after an import is not a baseline.
 *
 * Hand-derived values (Brzycki e1RM = kg x 36 / (37 - reps)):
 *   Ana's heaviest legacy bench (t-bench) is 60x8 -> weight 60, e1rm 60 x 36/29 = 74.48...
 *   A later 70x5 -> weight 70 > 60, e1rm 70 x 1.125 = 78.75 > 74.48: 2 real PRs, prCount 2.
 */
import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { draft, exercise, fakeSync, freshRepo, type TestRepo } from '@/lib/db/__tests__/helpers';
import { exportBackupJson, importLegacy, restoreBackupJson } from '..';
import { MULTI_USER_DUMP } from '../__fixtures__/expected';
import { loadFixtureText } from '../__fixtures__/load';
import { syntheticResolver } from '../service/__fixtures__/testing';

const TEXT = loadFixtureText(MULTI_USER_DUMP.file);
const STAMP = '2026-09-26T08:00:00.000Z';

async function importAna(t: TestRepo, profileId?: string) {
  const target = profileId === undefined ? { createProfileName: 'Ana' } : { profileId };
  const res = await importLegacy(t.repo, TEXT, { users: [{ username: 'Ana', target }], resolver: syntheticResolver(), now: () => STAMP });
  return res.perUser[0];
}

async function heavier(t: TestRepo, profileId: string) {
  t.tick(60_000);
  return t.repo.finishWorkout(draft('heavy', profileId, [exercise('u-heavy', 't-bench', [{ kg: 70, reps: 5 }])], { startedAt: t.now().toISOString() }));
}

describe('G3-02: importLegacy derives PR rows from the whole imported history', () => {
  it('the imported bench is the baseline; a heavier bench afterwards is a real PR', async () => {
    const t = freshRepo();
    const ana = await importAna(t);
    const best = await t.repo.prs.best(ana.profileId, 't-bench');
    expect(best.weight?.value).toBe(60);
    expect(best.e1rm?.value).toBeCloseTo(74.48, 2);
    // Every PR row the service reports as inserted is a live row of the profile.
    expect((await t.repo.prs.list(ana.profileId)).length).toBe(ana.prRecords.inserted);

    const r = await heavier(t, ana.profileId);
    expect(r.prs.map((c) => [c.prType, c.value, c.isBaseline])).toEqual([['e1rm', 78.75, false], ['weight', 70, false]]);
    expect(r.log.prCount).toBe(2);
  });

  it('re-importing writes nothing and leaves the outbox unchanged', async () => {
    const t = freshRepo({ sync: fakeSync() });
    const first = await importAna(t);
    const queued = await t.repo.outbox.count();
    const before = await t.repo.exportBackup(first.profileId);
    t.tick(60_000);
    const again = await importAna(t, first.profileId);
    expect(again.prRecords).toEqual({ inserted: 0, updated: 0, skipped: 0 });
    expect(again.logs).toEqual({ inserted: 0, updated: 0, skipped: MULTI_USER_DUMP.users.Ana.logs });
    expect(await t.repo.outbox.count()).toBe(queued);
    expect({ ...(await t.repo.exportBackup(first.profileId)), exportedAt: before.exportedAt }).toEqual(before);
  });

  it('a failure after the import rolls back the logs and the derived PR rows', async () => {
    const t = freshRepo({ sync: fakeSync() });
    const run = t.repo.transaction(async () => {
      const ana = await importAna(t);
      expect(ana.prRecords.inserted).toBeGreaterThan(0);
      throw new Error('boom');
    });
    await expect(run).rejects.toThrow('boom');
    expect([await t.db.profiles.count(), await t.db.workoutLogs.count(), await t.db.prRecords.count()]).toEqual([0, 0, 0]);
    expect(await t.repo.outbox.count()).toBe(0);
  });
});

describe('G3-02: restoreBackupJson of a backup without PR rows', () => {
  it('restores PR rows from the history, so the next heavier bench is a real PR', async () => {
    const src = freshRepo();
    const ana = await importAna(src);
    const backup = await src.repo.exportBackup(ana.profileId);
    const text = await exportBackupJson(src.repo, ana.profileId);
    const stripped = JSON.stringify({ ...JSON.parse(text), prRecords: [] });

    const dst = freshRepo({ start: new Date(Date.parse(STAMP) + 60_000) });
    await restoreBackupJson(dst.repo, stripped);
    const rows = await dst.repo.prs.list(ana.profileId);
    // Same (log, exercise, type, value) set as the source derived; ids are new.
    const shape = (xs: typeof rows) => xs.map((r) => `${r.workoutLogId}|${r.exerciseId}|${r.prType}|${r.value}`).sort();
    expect(shape(rows)).toEqual(shape(backup.prRecords.filter((r) => !r.deletedAt)));
    expect(rows.length).toBe(ana.prRecords.inserted);

    const r = await heavier(dst, ana.profileId);
    expect(r.prs.every((c) => !c.isBaseline)).toBe(true);
    expect(r.log.prCount).toBe(2);
  });
});
