/** Wave 2: machine setup (ExerciseNote.setup) and pinnedExerciseIds survive the JSON backup path. */
import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { freshRepo } from '@/lib/db/__tests__/helpers';
import { getNotesExt } from '@/lib/db/repo/notes';
import { exportBackupJson, isImportError, restoreBackupJson } from '..';
import { parseBackupV3 } from '../backup-v3';

async function seed() {
  const t = freshRepo();
  const p = await t.repo.profiles.create({ name: 'Ana' });
  await t.repo.profiles.updateSettings(p.id, { pinnedExerciseIds: ['bench', 'squat'] });
  await getNotesExt(t.repo).setSetup(p.id, 'bench', { seat: '4', benchAngle: '30°' });
  return { t, p };
}

describe('JSON backup keeps Wave 2 fields', () => {
  it('round-trips setup and pinned exercises into a fresh database', async () => {
    const { t, p } = await seed();
    const json = await exportBackupJson(t.repo, p.id);

    const fresh = freshRepo();
    await restoreBackupJson(fresh.repo, json);

    const profile = await fresh.repo.profiles.get(p.id);
    expect(profile?.settings.pinnedExerciseIds).toEqual(['bench', 'squat']);
    expect(await getNotesExt(fresh.repo).getSetup(p.id, 'bench')).toEqual({ seat: '4', benchAngle: '30°' });
    expect(await getNotesExt(fresh.repo).getSetup(p.id, 'squat')).toBeUndefined();
  });

  it('rejects an unknown setup key and invalid pins instead of stripping them', async () => {
    const { t, p } = await seed();
    const backup = JSON.parse(await exportBackupJson(t.repo, p.id)) as Record<string, unknown> & {
      exerciseNotes: Array<Record<string, unknown>>;
      profiles: Array<{ settings: Record<string, unknown> }>;
    };

    const badSetup = structuredClone(backup);
    badSetup.exerciseNotes[0].setup = { seat: '4', rackHeight: '9' };
    const badPins = structuredClone(backup);
    badPins.profiles[0].settings.pinnedExerciseIds = ['a', 'a'];

    for (const bad of [badSetup, badPins]) {
      let caught: unknown;
      try {
        parseBackupV3(JSON.stringify(bad));
      } catch (e) {
        caught = e;
      }
      expect(isImportError(caught) && caught.code).toBe('INVALID_STRUCTURE');
    }
  });
});
