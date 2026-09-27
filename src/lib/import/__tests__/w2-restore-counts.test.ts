/**
 * G2-REPORT Wave 2 unfixed #1: a restore could report a negative `skipped`.
 * importBackup counted the local notes it tombstones under the natural-key rule
 * as `updated`, and the service computes skipped = file rows − inserted − updated.
 */
import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { freshRepo } from '@/lib/db/__tests__/helpers';
import { exportBackupJson, restoreBackupJson } from '..';

const plus = (iso: string, ms: number) => new Date(Date.parse(iso) + ms).toISOString();

describe('restoreBackupJson counts', () => {
  it('newer notes under new ids for exercises that already have notes: inserted 3, updated 0, skipped 1', async () => {
    const t = freshRepo();
    const p = await t.repo.profiles.create({ name: 'A' });
    const exercises = ['bench', 'squat', 'row'];
    const locals = [];
    for (const e of exercises) {
      const n = await t.repo.notes.set(p.id, e, `local ${e}`);
      if (!n) throw new Error('note not created');
      locals.push(n);
    }
    // 4-row file: the unchanged profile + 3 newer notes under ids this device never had.
    const file = JSON.parse(await exportBackupJson(t.repo, p.id)) as Record<string, unknown>;
    file.exerciseNotes = locals.map((n, i) => ({ ...n, id: `backup-note-${i}`, content: `backup ${n.exerciseId}`, updatedAt: plus(n.updatedAt, 60_000) }));

    const result = await restoreBackupJson(t.repo, JSON.stringify(file), { confirmOverwrite: true });

    expect({ inserted: result.inserted, updated: result.updated, skipped: result.skipped }).toEqual({ inserted: 3, updated: 0, skipped: 1 });
    expect(result.skipped).toBeGreaterThanOrEqual(0);
    // The file's notes won; each local note is a tombstone now.
    for (const e of exercises) expect((await t.repo.notes.get(p.id, e))?.content).toBe(`backup ${e}`);
    for (const n of locals) expect((await t.db.exerciseNotes.get(n.id))?.deletedAt).toEqual(expect.any(String));
  });
});
