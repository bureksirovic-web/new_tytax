/** Wave 2 item 6 (G4-30): pinnedExerciseIds persisted through profile settings. */
import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import type { ProfileSettings } from '@/contracts';
import { MAX_PINNED_EXERCISES } from '..';
import { mergeSettings } from '../repo/settings';
import { expectCode, freshRepo } from './helpers';

async function withProfile() {
  const t = freshRepo();
  const p = await t.repo.profiles.create({ name: 'Marko' });
  return { ...t, p };
}

describe('settings.pinnedExerciseIds', () => {
  it('is absent by default and stored in the given order', async () => {
    const { repo, p } = await withProfile();
    expect(p.settings.pinnedExerciseIds).toBeUndefined();
    const next = await repo.profiles.updateSettings(p.id, { pinnedExerciseIds: ['squat', 'bench', 'row'] });
    expect(next.settings.pinnedExerciseIds).toEqual(['squat', 'bench', 'row']);
    expect((await repo.profiles.get(p.id))?.settings.pinnedExerciseIds).toEqual(['squat', 'bench', 'row']);
  });

  it('survives an unrelated settings patch', async () => {
    const { repo, p } = await withProfile();
    await repo.profiles.updateSettings(p.id, { pinnedExerciseIds: ['dip'] });
    const next = await repo.profiles.updateSettings(p.id, { restSeconds: 120 });
    expect(next.settings).toMatchObject({ restSeconds: 120, pinnedExerciseIds: ['dip'] });
  });

  it('null, undefined (key present) and [] clear the pins', async () => {
    const { repo, p } = await withProfile();
    const cleared: Array<Partial<ProfileSettings>> = [
      { pinnedExerciseIds: undefined },
      { pinnedExerciseIds: null as unknown as undefined },
      { pinnedExerciseIds: [] },
    ];
    for (const patch of cleared) {
      await repo.profiles.updateSettings(p.id, { pinnedExerciseIds: ['a', 'b'] });
      const next = await repo.profiles.updateSettings(p.id, patch);
      expect('pinnedExerciseIds' in next.settings).toBe(false);
    }
  });

  it(`accepts exactly ${MAX_PINNED_EXERCISES} and rejects more, duplicates, empty and non-string ids`, async () => {
    const { repo, p } = await withProfile();
    expect(MAX_PINNED_EXERCISES).toBe(4);
    await repo.profiles.updateSettings(p.id, { pinnedExerciseIds: ['a', 'b', 'c', 'd'] });
    const bad: unknown[] = [['a', 'b', 'c', 'd', 'e'], ['a', 'a'], [''], ['  '], [7], 'squat', { 0: 'a' }];
    for (const v of bad) {
      await expectCode(repo.profiles.updateSettings(p.id, { pinnedExerciseIds: v as string[] }), 'VALIDATION');
    }
    // the rejected patches changed nothing
    expect((await repo.profiles.get(p.id))?.settings.pinnedExerciseIds).toEqual(['a', 'b', 'c', 'd']);
  });

  it('is accepted on profile create and never aliases the caller array', async () => {
    const { repo } = freshRepo();
    const input = ['bench', 'squat'];
    const p = await repo.profiles.create({ name: 'Iva', settings: { pinnedExerciseIds: input } });
    input.push('row');
    expect(p.settings.pinnedExerciseIds).toEqual(['bench', 'squat']);
    const base = { ...p.settings };
    const merged = mergeSettings(base, {});
    expect(merged.pinnedExerciseIds).not.toBe(base.pinnedExerciseIds);
  });

  it('round-trips through exportBackup -> importBackup', async () => {
    const { repo, p } = await withProfile();
    await repo.profiles.updateSettings(p.id, { pinnedExerciseIds: ['row', 'squat'] });
    const dst = freshRepo();
    await dst.repo.importBackup(await repo.exportBackup(p.id));
    expect((await dst.repo.profiles.get(p.id))?.settings.pinnedExerciseIds).toEqual(['row', 'squat']);
  });
});
