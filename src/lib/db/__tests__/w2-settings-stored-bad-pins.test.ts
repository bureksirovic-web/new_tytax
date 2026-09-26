/**
 * Wave 2 refuter finding (reproduced, fixed in settings.ts): importBackup and
 * applyRemote store settings verbatim, so a profile row can hold pins the
 * validator rejects (null, duplicates, > 4). Such a row must not block an
 * unrelated settings patch; the stored list is sanitised on the next merge.
 */
import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import type { BackupV3 } from '@/contracts/repo';
import { defaultSettings, mergeSettings, sanitizePins } from '../repo/settings';
import { T0, freshRepo } from './helpers';

const DAY = 86_400_000;

describe('sanitizePins', () => {
  it('keeps first occurrences of non-empty string ids, max 4, else undefined', () => {
    expect(sanitizePins(null)).toBeUndefined();
    expect(sanitizePins('bench')).toBeUndefined();
    expect(sanitizePins([])).toBeUndefined();
    expect(sanitizePins(['', '  ', 7])).toBeUndefined();
    // ['bench','bench'] -> first 'bench' only
    expect(sanitizePins(['bench', 'bench'])).toEqual(['bench']);
    // 5 ids -> first 4 in order
    expect(sanitizePins(['a', 'b', 'c', 'd', 'e'])).toEqual(['a', 'b', 'c', 'd']);
    // ['a', 7, 'a', 'b'] -> drop 7 and the second 'a'
    expect(sanitizePins(['a', 7, 'a', 'b'])).toEqual(['a', 'b']);
  });

  it('mergeSettings sanitises a bad base; an explicit pins patch is still validated strictly', () => {
    const base = { ...defaultSettings(), pinnedExerciseIds: ['a', 'a', 'b'] };
    // base ['a','a','b'] -> ['a','b']; patch touches only units
    expect(mergeSettings(base, { units: 'lb' })).toMatchObject({ units: 'lb', pinnedExerciseIds: ['a', 'b'] });
    expect(base.pinnedExerciseIds).toEqual(['a', 'a', 'b']); // input not mutated
    expect(() => mergeSettings(base, { pinnedExerciseIds: ['c', 'c'] })).toThrow('must not repeat an id');
  });
});

describe('stored invalid pins do not block settings edits', () => {
  const cases: ReadonlyArray<readonly [string, unknown, string[] | undefined]> = [
    ['null', null, undefined],
    ['duplicates', ['bench', 'bench'], ['bench']],
    ['more than 4', ['a', 'b', 'c', 'd', 'e'], ['a', 'b', 'c', 'd']],
  ];
  for (const [label, pins, expected] of cases) {
    it(`importBackup with pins ${label} -> updateSettings({ units: 'lb' }) succeeds`, async () => {
      const src = freshRepo();
      const p = await src.repo.profiles.create({ name: 'P' });
      const backup = await src.repo.exportBackup(p.id);
      const profiles = backup.profiles.map((row) => ({ ...row, settings: { ...row.settings, pinnedExerciseIds: pins } }));
      const dst = freshRepo({ start: new Date(T0.getTime() + 10 * DAY) });
      await dst.repo.importBackup({ ...backup, profiles } as unknown as BackupV3);
      const next = await dst.repo.profiles.updateSettings(p.id, { units: 'lb' });
      expect(next.settings.units).toBe('lb');
      expect(next.settings.pinnedExerciseIds).toEqual(expected);
      expect('pinnedExerciseIds' in next.settings).toBe(expected !== undefined);
    });
  }

  it('applyRemote(profiles) with pins null (SQL NULL) -> updateSettings({ units }) succeeds', async () => {
    const t = freshRepo();
    const p = await t.repo.profiles.create({ name: 'P' });
    const pulled = { ...p, settings: { ...p.settings, pinnedExerciseIds: null }, updatedAt: new Date(T0.getTime() + DAY).toISOString() };
    await t.repo.applyRemote('profiles', [pulled as unknown as Record<string, unknown>]);
    t.tick(2 * DAY);
    const next = await t.repo.profiles.updateSettings(p.id, { units: 'lb' });
    expect(next.settings.units).toBe('lb');
    expect('pinnedExerciseIds' in next.settings).toBe(false);
  });

  it('a bad stored list is replaced wholesale by a valid pins patch', async () => {
    const t = freshRepo();
    const p = await t.repo.profiles.create({ name: 'P' });
    const pulled = { ...p, settings: { ...p.settings, pinnedExerciseIds: ['x', 'x'] }, updatedAt: new Date(T0.getTime() + DAY).toISOString() };
    await t.repo.applyRemote('profiles', [pulled as unknown as Record<string, unknown>]);
    t.tick(2 * DAY);
    const next = await t.repo.profiles.updateSettings(p.id, { pinnedExerciseIds: ['row', 'squat'] });
    expect(next.settings.pinnedExerciseIds).toEqual(['row', 'squat']);
  });
});
