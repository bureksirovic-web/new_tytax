/** previewLegacyImport and importLegacy option checks, including the default (real catalog) resolver. */
import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { isRepoError, type Repository } from '@/contracts';
import { freshRepo } from '@/lib/db/__tests__/helpers';
import { importLegacy, isImportError, previewLegacyImport, type ImportLegacyOptions } from '..';
import { MULTI_USER_DUMP, SINGLE_USER_DUMP } from '../__fixtures__/expected';
import { loadFixtureText } from '../__fixtures__/load';
import { snapshot, syntheticResolver } from '../service/__fixtures__/testing';

const MULTI = loadFixtureText(MULTI_USER_DUMP.file);
const SINGLE = loadFixtureText(SINGLE_USER_DUMP.file);

describe('legacy-import service: preview', () => {
  it('summarises every user without touching the database', async () => {
    const { repo } = freshRepo();
    const before = await snapshot(repo);
    const preview = await previewLegacyImport(MULTI, { resolver: syntheticResolver() });
    expect(preview.format).toBe('localstorage-dump');
    expect(preview.warnings).toHaveLength(MULTI_USER_DUMP.warnings);
    expect(preview.warnings.every((w) => w.username === undefined)).toBe(true);
    for (const u of preview.users) {
      const exp = MULTI_USER_DUMP.users[u.username];
      expect(u).toMatchObject({ logs: exp.logs, sets: exp.sets, bodyweight: exp.bodyweight, programs: 1 + exp.customProtocols });
      expect(u.warnings.every((w) => w.username === u.username)).toBe(true);
    }
    const ana = preview.users.find((u) => u.username === 'Ana');
    // RDL: log 2 + plan Lower A = 2; shoulder press: log 4 + plan Upper A = 2.
    expect(ana?.unresolved).toEqual([
      { legacyName: 'TYTAX T1 | Smith Romanian Deadlift (RDL)', occurrences: 2 },
      { legacyName: 'TYTAX T1 | Smith Seated Shoulder Press', occurrences: 2 },
    ]);
    expect(await snapshot(repo)).toEqual(before);
  });

  it('accepts an already-parsed value and rejects an unusable file', async () => {
    const preview = await previewLegacyImport(JSON.parse(SINGLE) as unknown, { resolver: syntheticResolver() });
    expect(preview.users.map((u) => u.username)).toEqual(['default']);
    expect(preview.users[0].logs).toBe(SINGLE_USER_DUMP.users.default.logs);
    await expect(previewLegacyImport('{"nope":1}', { resolver: syntheticResolver() })).rejects.toSatisfy(
      (e: unknown) => isImportError(e) && e.code === 'UNRECOGNIZED_FORMAT',
    );
  });

  it('defaults to the real catalog resolver', async () => {
    const preview = await previewLegacyImport(SINGLE);
    const u = preview.users[0];
    expect(u.logs).toBe(SINGLE_USER_DUMP.users.default.logs);
    expect(u.bodyweight).toBe(SINGLE_USER_DUMP.users.default.bodyweight);
    expect(u.unresolved.every((x) => x.occurrences > 0)).toBe(true);
  });
});

describe('legacy-import service: options', () => {
  async function rejects(repo: Repository, users: ImportLegacyOptions['users'], code: 'VALIDATION' | 'NOT_FOUND') {
    const before = await snapshot(repo);
    await expect(importLegacy(repo, MULTI, { users, resolver: syntheticResolver() })).rejects.toSatisfy((e: unknown) =>
      isRepoError(e, code),
    );
    expect(await snapshot(repo)).toEqual(before);
  }

  it('rejects empty, unknown, duplicate and colliding selections before writing', async () => {
    const { repo } = freshRepo();
    const p = await repo.profiles.create({ name: 'Target' });
    await rejects(repo, [], 'VALIDATION');
    await rejects(repo, [{ username: 'Nobody', target: { createProfileName: 'X' } }], 'VALIDATION');
    await rejects(
      repo,
      [
        { username: 'Ana', target: { createProfileName: 'A' } },
        { username: 'Ana', target: { createProfileName: 'B' } },
      ],
      'VALIDATION',
    );
    await rejects(
      repo,
      [
        { username: 'Ana', target: { profileId: p.id } },
        { username: 'Marko Horvat', target: { profileId: p.id } },
      ],
      'VALIDATION',
    );
    await repo.profiles.remove(p.id);
    await rejects(repo, [{ username: 'Ana', target: { profileId: p.id } }], 'NOT_FOUND');
  });

  it('imports with the default resolver and the wall clock', async () => {
    const { repo } = freshRepo();
    const result = await importLegacy(repo, SINGLE, { users: [{ username: 'default', target: { createProfileName: 'Me' } }] });
    const [u] = result.perUser;
    expect(u.logs.inserted).toBe(SINGLE_USER_DUMP.users.default.logs);
    expect(await repo.logs.count(u.profileId)).toBe(SINGLE_USER_DUMP.users.default.logs);
    const log = (await repo.logs.list(u.profileId))[0];
    expect(Number.isFinite(Date.parse(log.createdAt))).toBe(true);
  });
});
