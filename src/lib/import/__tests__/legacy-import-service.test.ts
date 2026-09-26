/** AC10 / AC18: legacy multi-user dump -> repository, via importLegacy. */
import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { isRepoError, type Repository } from '@/contracts';
import { freshRepo } from '@/lib/db/__tests__/helpers';
import { importLegacy, isImportError, mapLegacyUser, parseLegacyBackup } from '..';
import { ALL_FIXTURES, MULTI_USER_DUMP } from '../__fixtures__/expected';
import { loadFixtureText } from '../__fixtures__/load';
import { countingResolver, snapshot, syntheticResolver } from '../service/__fixtures__/testing';

const TEXT = loadFixtureText(MULTI_USER_DUMP.file);
const USERNAMES = Object.keys(MULTI_USER_DUMP.users);
const FIRST = '2026-09-26T08:00:00.000Z';
const LATER = '2026-09-27T09:30:00.000Z';

/** Programs per user: the imported plan (it has sessions) + one per own custom protocol. */
const expectedPrograms = (u: (typeof MULTI_USER_DUMP.users)[string]) => (u.planSessions > 0 ? 1 : 0) + u.customProtocols;

async function importAllNew(repo: Repository) {
  return importLegacy(repo, TEXT, {
    users: USERNAMES.map((username) => ({ username, target: { createProfileName: username } })),
    resolver: syntheticResolver(),
    now: () => FIRST,
  });
}

describe('legacy-import service: AC10 exact counts per profile', () => {
  // Every fixture format, the legacy "Backup" export (app-backup.json) included.
  it.each(ALL_FIXTURES.map((f) => [f.file, f] as const))('%s imports into new profiles with the expected counts', async (_file, fixture) => {
    const { repo } = freshRepo();
    const result = await importLegacy(repo, loadFixtureText(fixture.file), {
      users: Object.keys(fixture.users).map((username) => ({ username, target: { createProfileName: username } })),
      resolver: syntheticResolver(),
      now: () => FIRST,
    });
    expect(result.perUser.map((u) => u.username)).toEqual(Object.keys(fixture.users));
    for (const r of result.perUser) {
      const exp = fixture.users[r.username];
      expect(await repo.logs.count(r.profileId)).toBe(exp.logs);
      expect(await repo.programs.list(r.profileId)).toHaveLength(expectedPrograms(exp));
      expect(await repo.bodyweight.list(r.profileId)).toHaveLength(exp.bodyweight);
      const sets = (await repo.logs.list(r.profileId)).flatMap((l) => l.exercises.flatMap((e) => e.sets));
      expect(sets).toHaveLength(exp.sets);
      expect(sets.filter((s) => s.type === 'warmup')).toHaveLength(exp.warmupSets);
    }
  });

  it('imports the multi-user dump into fresh profiles with the expected counts', async () => {
    const { repo } = freshRepo();
    const result = await importAllNew(repo);
    expect(result.perUser.map((u) => u.username)).toEqual(USERNAMES);
    for (const r of result.perUser) {
      const exp = MULTI_USER_DUMP.users[r.username];
      expect(r.createdProfile).toBe(true);
      expect((await repo.profiles.get(r.profileId))?.name).toBe(r.username);
      expect(await repo.logs.count(r.profileId)).toBe(exp.logs);
      expect(await repo.programs.list(r.profileId)).toHaveLength(expectedPrograms(exp));
      expect(await repo.bodyweight.list(r.profileId)).toHaveLength(exp.bodyweight);
      expect(r.logs).toEqual({ inserted: exp.logs, updated: 0, skipped: 0 });
      expect(r.bodyweight).toEqual({ inserted: exp.bodyweight, updated: 0, skipped: 0 });
      expect(r.programs).toEqual({ inserted: expectedPrograms(exp), updated: 0, skipped: 0 });
      const sets = (await repo.logs.list(r.profileId)).flatMap((l) => l.exercises.flatMap((e) => e.sets));
      expect(sets).toHaveLength(exp.sets);
      expect(sets.filter((s) => s.type === 'warmup')).toHaveLength(exp.warmupSets);
      const active = await repo.programs.getActive(r.profileId);
      expect(active?.id).toBe(r.activatedProgramId);
      expect(active?.sessions).toHaveLength(exp.sessionOrder);
    }
    expect(result.unresolved.map((u) => u.legacyName)).toEqual([
      'TYTAX T1 | Smith Romanian Deadlift (RDL)',
      'TYTAX T1 | Smith Seated Shoulder Press',
    ]);
    expect(result.warnings.filter((w) => w.username === undefined)).toHaveLength(MULTI_USER_DUMP.warnings);
  });

  it('applies only the legacy settings keys to a newly created profile', async () => {
    const { repo } = freshRepo();
    const result = await importAllNew(repo);
    const ana = result.perUser[0];
    expect(ana.settingsApplied).toEqual(['barWeightKg', 'language', 'theme', 'warmupStrategy']);
    const settings = (await repo.profiles.get(ana.profileId))?.settings;
    expect(settings).toMatchObject({ theme: 'oled', warmupStrategy: 'heavy', language: 'hr', barWeightKg: 20, restSeconds: 90 });
  });

  it('preserves a duplicate exercise inside one session (AC18)', async () => {
    const { repo } = freshRepo();
    const result = await importAllNew(repo);
    const logs = await repo.logs.list(result.perUser[0].profileId);
    const lower = logs.find((l) => l.date === '2025-01-03');
    const squats = lower?.exercises.filter((e) => e.exerciseId === 't-squat') ?? [];
    expect(squats).toHaveLength(2);
    expect(new Set(squats.map((e) => e.uid)).size).toBe(2);
    expect(squats.map((e) => e.sets.length)).toEqual([2, 2]);
  });
});

describe('legacy-import service: AC18 idempotency and atomicity', () => {
  it('re-importing into the same profiles changes nothing', async () => {
    const { repo } = freshRepo();
    const first = await importAllNew(repo);
    const before = await snapshot(repo);
    const again = await importLegacy(repo, TEXT, {
      users: first.perUser.map((u) => ({ username: u.username, target: { profileId: u.profileId } })),
      resolver: syntheticResolver(),
      now: () => LATER,
    });
    expect(await snapshot(repo)).toEqual(before);
    for (const r of again.perUser) {
      const exp = MULTI_USER_DUMP.users[r.username];
      expect(r.createdProfile).toBe(false);
      expect(r.logs).toEqual({ inserted: 0, updated: 0, skipped: exp.logs });
      expect(r.programs.inserted).toBe(0);
      expect(r.bodyweight.inserted).toBe(0);
      expect(r.prRecords).toEqual({ inserted: 0, updated: 0, skipped: 0 });
      expect(r.activatedProgramId).toBeNull();
      expect(r.settingsApplied).toEqual([]);
      expect(await repo.logs.count(r.profileId)).toBe(exp.logs);
    }
  });

  it('a resolver that throws midway (after the first user is written) leaves the DB unchanged', async () => {
    const { repo } = freshRepo();
    const seeded = await repo.profiles.ensureActive('Existing');
    await repo.bodyweight.add(seeded.id, { date: '2026-01-01', valueKg: 70 });
    const before = await snapshot(repo);
    const bundle = parseLegacyBackup(TEXT);
    const probe = countingResolver();
    mapLegacyUser(bundle.users[0], { profileId: 'probe', resolver: probe, importedAt: FIRST });
    const failing = countingResolver(probe.calls() + 1);
    await expect(
      importLegacy(repo, TEXT, {
        users: USERNAMES.map((username) => ({ username, target: { createProfileName: username } })),
        resolver: failing,
        now: () => FIRST,
      }),
    ).rejects.toThrow('resolver exploded');
    expect(failing.calls()).toBeGreaterThan(probe.calls());
    expect(await snapshot(repo)).toEqual(before);
    expect(await repo.profiles.getActiveId()).toBe(seeded.id);
  });

  it('a record that fails validation leaves the DB unchanged', async () => {
    const { repo } = freshRepo();
    await repo.profiles.ensureActive('Existing');
    const before = await snapshot(repo);
    const run = importLegacy(repo, TEXT, {
      users: [{ username: 'Ana', target: { createProfileName: 'Ana' } }],
      resolver: syntheticResolver(),
      now: () => 'not-a-timestamp',
    });
    await expect(run).rejects.toSatisfy((e: unknown) => isImportError(e) && e.code === 'INVALID_STRUCTURE');
    expect(await snapshot(repo)).toEqual(before);
    expect(await repo.profiles.list()).toHaveLength(1);
  });

  it('a missing target profile for the second user rolls back the first', async () => {
    const { repo } = freshRepo();
    const before = await snapshot(repo);
    const run = importLegacy(repo, TEXT, {
      users: [
        { username: 'Ana', target: { createProfileName: 'Ana' } },
        { username: 'Marko Horvat', target: { profileId: 'no-such-profile' } },
      ],
      resolver: syntheticResolver(),
      now: () => FIRST,
    });
    await expect(run).rejects.toSatisfy((e: unknown) => isRepoError(e, 'NOT_FOUND'));
    expect(await snapshot(repo)).toEqual(before);
    expect(await repo.profiles.list()).toEqual([]);
  });
});
