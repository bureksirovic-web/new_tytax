/**
 * A restored note with content '' and setup {} (the backup schema accepts
 * `{}`) is not live: notes.ts treats a setup without fields as no setup, like
 * `setSetup(.., {})`, and `set(.., '')` tombstones the row.
 */
import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { freshRepo, T0 } from '@/lib/db/__tests__/helpers';
import { getNotesExt } from '@/lib/db/repo/notes';
import { exportBackupJson, restoreBackupJson } from '..';

const STAMP = T0.toISOString();

/** Ana's own backup, her only note replaced by one with empty content and setup {}. */
async function hostile(repo: ReturnType<typeof freshRepo>['repo'], pid: string): Promise<string> {
  const file = JSON.parse(await exportBackupJson(repo, pid)) as Record<string, unknown>;
  file.exerciseNotes = [
    { id: 'n-empty', profileId: pid, exerciseId: 'bench', content: '', setup: {}, createdAt: STAMP, updatedAt: STAMP },
  ];
  return JSON.stringify(file);
}

describe('a restored note with content "" and setup {}', () => {
  it('is not live (notes.ts:4-6: live only with content OR a setup)', async () => {
    const t = freshRepo();
    const p = await t.repo.profiles.create({ name: 'Ana' });
    await restoreBackupJson(t.repo, await hostile(t.repo, p.id), { confirmOverwrite: true });
    expect((await t.db.exerciseNotes.get('n-empty'))?.setup, 'the row is stored as given').toEqual({});
    expect(await t.repo.notes.get(p.id, 'bench'), 'it has no content and no setup').toBeUndefined();
    expect(await getNotesExt(t.repo).getSetup(p.id, 'bench'), 'setSetup(.., {}) means no setup').toBeUndefined();
  });

  it('can be deleted with set(profileId, exerciseId, "")', async () => {
    const t = freshRepo();
    const p = await t.repo.profiles.create({ name: 'Ana' });
    await restoreBackupJson(t.repo, await hostile(t.repo, p.id), { confirmOverwrite: true });
    await t.repo.notes.set(p.id, 'bench', '');
    expect(await t.repo.notes.get(p.id, 'bench'), 'an empty note without a setup must go away').toBeUndefined();
    expect((await t.repo.notes.list(p.id)).length).toBe(0);
    expect((await t.db.exerciseNotes.get('n-empty'))?.deletedAt, 'the row is tombstoned').toBeTypeOf('string');
  });
});
