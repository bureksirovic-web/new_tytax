/** repo.importBackup audit (src/lib/db/repo/transfer.ts): LWW, references, conflicts, atomicity, meta. */
import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { isRepoError, type BackupV3, type RepoErrorCode, type Repository } from '@/contracts';
import { freshRepo, template } from '@/lib/db/__tests__/helpers';
import { snapshot } from '../service/__fixtures__/testing';

async function base() {
  const t = freshRepo();
  const a = await t.repo.profiles.create({ name: 'A' });
  const program = await t.repo.programs.create(a.id, template(2), { activate: true });
  await t.repo.bodyweight.add(a.id, { date: '2026-03-01', valueKg: 70 });
  const backup = await t.repo.exportBackup(a.id);
  return { ...t, a: (await t.repo.profiles.get(a.id)) ?? a, program, backup };
}

async function expectRejected(repo: Repository, backup: BackupV3, code: RepoErrorCode) {
  const before = await snapshot(repo);
  await expect(repo.importBackup(backup)).rejects.toSatisfy((e: unknown) => isRepoError(e, code));
  expect(await snapshot(repo)).toEqual(before);
}

describe('importBackup: last-write-wins on updatedAt', () => {
  it('never clobbers a newer local row; applies a newer, or an equal-time different, incoming row', async () => {
    const t = await base();
    t.tick(60_000);
    await t.repo.profiles.update(t.a.id, { name: 'Renamed later' });
    const bw = t.backup.bodyweightEntries[0];
    const newerBw = { ...bw, valueKg: 71, updatedAt: new Date(t.now().getTime() + 1000).toISOString() };
    const tieProgram = { ...t.backup.programs[0], name: 'Same time, other device' };
    const result = await t.repo.importBackup({ ...t.backup, programs: [tieProgram], bodyweightEntries: [newerBw] });
    // profile skipped (local newer), program rewritten (tie, different content), bodyweight updated (incoming newer).
    expect(result).toEqual({ inserted: 0, updated: 2 });
    expect((await t.repo.profiles.get(t.a.id))?.name).toBe('Renamed later');
    expect((await t.repo.programs.get(t.a.id, t.program.id))?.name).toBe('Same time, other device');
    expect((await t.repo.bodyweight.list(t.a.id))[0].valueKg).toBe(71);
  });

  it('an identical row (same updatedAt, same content) is a no-op', async () => {
    const t = await base();
    expect(await t.repo.importBackup(t.backup)).toEqual({ inserted: 0, updated: 0 });
  });

  it('an incoming row without a parseable updatedAt never beats a local row but is inserted when new', async () => {
    const t = await base();
    const bw = t.backup.bodyweightEntries[0];
    const broken = { ...bw, valueKg: 99, updatedAt: 'garbage' };
    const fresh = { ...bw, id: 'bw-new', updatedAt: 'garbage' };
    expect(await t.repo.importBackup({ ...t.backup, profiles: [], programs: [], bodyweightEntries: [broken, fresh] })).toEqual({
      inserted: 1,
      updated: 0,
    });
    const rows = await t.repo.bodyweight.list(t.a.id);
    expect(rows.find((b) => b.id === bw.id)?.valueKg).toBe(70);
    expect(rows.map((b) => b.id).sort()).toEqual([bw.id, 'bw-new'].sort());
  });
});

describe('importBackup: references and conflicts', () => {
  it('rejects a row owned by an unknown profile', async () => {
    const t = await base();
    const orphan = { ...t.backup.bodyweightEntries[0], id: 'bw-x', profileId: 'ghost' };
    await expectRejected(t.repo, { ...t.backup, bodyweightEntries: [orphan] }, 'VALIDATION');
  });

  it('rejects a row id that exists under another profile (CONFLICT), after nothing was written', async () => {
    const t = await base();
    const b = await t.repo.profiles.create({ name: 'B' });
    const stolen = { ...t.backup.bodyweightEntries[0], profileId: b.id };
    const newProfile = { ...t.a, id: 'p-new', name: 'New', activeProgramId: null };
    await expectRejected(t.repo, { ...t.backup, profiles: [newProfile], programs: [], bodyweightEntries: [stolen] }, 'CONFLICT');
    expect(await t.repo.profiles.get('p-new')).toBeUndefined();
  });

  it('rejects an activeProgramId that is not a program of that profile', async () => {
    const t = await base();
    const b = await t.repo.profiles.create({ name: 'B' });
    const bBackup = await t.repo.exportBackup(b.id);
    const pointing = { ...bBackup.profiles[0], activeProgramId: t.program.id };
    await expectRejected(t.repo, { ...bBackup, profiles: [pointing] }, 'VALIDATION');
    const dangling = { ...t.a, activeProgramId: 'no-such-program' };
    await expectRejected(t.repo, { ...t.backup, profiles: [dangling] }, 'VALIDATION');
  });

  it('accepts an activeProgramId that names a program already in the database', async () => {
    const t = await base();
    expect(await t.repo.importBackup({ ...t.backup, programs: [] })).toEqual({ inserted: 0, updated: 0 });
    expect((await t.repo.programs.getActive(t.a.id))?.id).toBe(t.program.id);
  });

  it('rejects duplicate ids and rows without profileId', async () => {
    const t = await base();
    const bw = t.backup.bodyweightEntries[0];
    await expectRejected(t.repo, { ...t.backup, bodyweightEntries: [bw, { ...bw }] }, 'VALIDATION');
    const { profileId: _drop, ...noOwner } = bw;
    expect(_drop).toBe(t.a.id);
    await expectRejected(t.repo, { ...t.backup, bodyweightEntries: [noOwner] } as unknown as BackupV3, 'VALIDATION');
  });
});

describe('importBackup: device meta and export scope', () => {
  it('never changes the active profile', async () => {
    const t = await base();
    await t.repo.profiles.setActive(t.a.id);
    const c = { ...t.a, id: 'p-c', name: 'C', activeProgramId: null };
    expect(await t.repo.importBackup({ ...t.backup, profiles: [c], programs: [], bodyweightEntries: [] })).toEqual({ inserted: 1, updated: 0 });
    expect(await t.repo.profiles.getActiveId()).toBe(t.a.id);
    expect((await t.repo.profiles.list()).map((p) => p.name).sort()).toEqual(['A', 'C']);
  });

  it('exportBackup of an unknown profile is NOT_FOUND', async () => {
    const t = await base();
    await expect(t.repo.exportBackup('ghost')).rejects.toSatisfy((e: unknown) => isRepoError(e, 'NOT_FOUND'));
  });
});
