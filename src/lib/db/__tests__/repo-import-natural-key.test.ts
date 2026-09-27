/**
 * importBackup keeps one live note / arsenal row per (profileId, exerciseId)
 * when the backup's row id differs from the local one
 * (src/lib/db/repo/natural-key.ts, import-plan.ts).
 */
import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import type { BackupV3 } from '@/contracts/repo';
import { fakeSync, freshRepo, type TestRepo } from './helpers';

const plus = (iso: string, ms: number): string => new Date(Date.parse(iso) + ms).toISOString();

async function liveNotes(t: TestRepo, profileId: string) {
  return (await t.db.exerciseNotes.where('[profileId+exerciseId]').equals([profileId, 'bench']).toArray()).filter((n) => !n.deletedAt);
}

/** A local note on this device plus a backup whose note for the same key has another id. */
async function setup(sync: boolean, backupOffsetMs: number) {
  const t = freshRepo({ sync: fakeSync(sync) });
  const p = await t.repo.profiles.create({ name: 'A' });
  const local = await t.repo.notes.set(p.id, 'bench', 'local text');
  if (!local) throw new Error('note not created');
  const base = await t.repo.exportBackup(p.id);
  const foreign = { ...local, id: 'other-device-note', content: 'backup text', updatedAt: plus(local.updatedAt, backupOffsetMs) };
  const backup: BackupV3 = { ...base, exerciseNotes: [foreign] };
  return { t, p, local, foreign, backup };
}

describe('importBackup: exercise notes with a different id for the same key', () => {
  it('newer backup content wins; the local row is tombstoned; a second restore writes nothing', async () => {
    const { t, p, local, foreign, backup } = await setup(true, 60_000);

    // updated 0 (was 1): counts are file rows only; the local loser tombstoned in place is not a
    // file row, and counting it let restoreBackupJson report a negative `skipped` (G2-REPORT Wave 2 #1).
    expect(await t.repo.importBackup(backup)).toEqual({ inserted: 1, updated: 0 });
    const live = await liveNotes(t, p.id);
    expect(live.map((n) => [n.id, n.content])).toEqual([[foreign.id, 'backup text']]);
    const loser = await t.db.exerciseNotes.get(local.id);
    expect(loser?.deletedAt).toBe(plus(foreign.updatedAt, 1));
    expect(loser?.updatedAt).toBe(loser?.deletedAt);
    expect((await t.repo.notes.get(p.id, 'bench'))?.content).toBe('backup text');

    const queued = await t.repo.outbox.count();
    expect(await t.repo.importBackup(backup)).toEqual({ inserted: 0, updated: 0 });
    expect(await t.repo.outbox.count()).toBe(queued);
    expect(await liveNotes(t, p.id)).toHaveLength(1);
  });

  it('older backup content loses: local stays, backup id lands as a tombstone, re-restore is a no-op', async () => {
    const { t, p, local, foreign, backup } = await setup(true, -60_000);

    expect(await t.repo.importBackup(backup)).toEqual({ inserted: 1, updated: 0 });
    expect((await liveNotes(t, p.id)).map((n) => [n.id, n.content])).toEqual([[local.id, 'local text']]);
    expect((await t.db.exerciseNotes.get(foreign.id))?.deletedAt).toBe(plus(local.updatedAt, 1));

    expect(await t.repo.importBackup(backup)).toEqual({ inserted: 0, updated: 0 });
    expect(await liveNotes(t, p.id)).toHaveLength(1);
  });

  it('an exact tie resolves to the larger id', async () => {
    const { t, p, backup } = await setup(false, 0);
    await t.repo.importBackup(backup);
    // 'other-device-note' > 'id-2' lexicographically
    expect((await liveNotes(t, p.id)).map((n) => n.id)).toEqual(['other-device-note']);
  });

  it('queues an upsert for both the winner and the tombstoned loser when sync is on', async () => {
    const { t, local, foreign, backup } = await setup(true, 60_000);
    const before = await t.repo.outbox.peek(100);
    await t.repo.importBackup(backup);
    const added = (await t.repo.outbox.peek(100)).slice(before.length);
    expect(added.filter((o) => o.table === 'exercise_notes').map((o) => [o.op, o.recordId]).sort()).toEqual(
      [['upsert', foreign.id], ['upsert', local.id]].sort(),
    );
  });

  it('queues nothing when sync is off but still resolves to one live row', async () => {
    const { t, p, backup } = await setup(false, 60_000);
    await t.repo.importBackup(backup);
    expect(await t.repo.outbox.count()).toBe(0);
    expect(await liveNotes(t, p.id)).toHaveLength(1);
  });

  it('a later notes.set edits the single live row instead of creating another', async () => {
    const { t, p, foreign, backup } = await setup(false, 60_000);
    await t.repo.importBackup(backup);
    t.tick(120_000);
    const edited = await t.repo.notes.set(p.id, 'bench', 'edited');
    expect(edited?.id).toBe(foreign.id);
    expect((await liveNotes(t, p.id)).map((n) => n.content)).toEqual(['edited']);
  });

  it('two live backup rows for one key collapse to one', async () => {
    const { t, p, foreign, backup } = await setup(false, 60_000);
    const twin = { ...foreign, id: 'third-device-note', content: 'twin', updatedAt: plus(foreign.updatedAt, 5) };
    await t.repo.importBackup({ ...backup, exerciseNotes: [foreign, twin] });
    expect((await liveNotes(t, p.id)).map((n) => n.content)).toEqual(['twin']);
    expect(await t.db.exerciseNotes.count()).toBe(3);
  });
});

describe('importBackup: arsenal entries with a different id for the same key', () => {
  it('restore twice leaves exactly one live entry; newer backup row wins', async () => {
    const t = freshRepo({ sync: fakeSync(true) });
    const p = await t.repo.profiles.create({ name: 'A' });
    const local = await t.repo.arsenal.add(p.id, 'bench');
    const base = await t.repo.exportBackup(p.id);
    const foreign = { ...local, id: 'other-device-arsenal', updatedAt: plus(local.updatedAt, 1000) };
    const backup: BackupV3 = { ...base, arsenal: [foreign] };

    // updated 0 (was 1): the local loser is not a file row (see the notes test above).
    expect(await t.repo.importBackup(backup)).toEqual({ inserted: 1, updated: 0 });
    expect(await t.repo.importBackup(backup)).toEqual({ inserted: 0, updated: 0 });
    expect((await t.repo.arsenal.list(p.id)).map((a) => a.id)).toEqual([foreign.id]);
    expect(await t.repo.arsenal.has(p.id, 'bench')).toBe(true);
    expect((await t.db.arsenal.get(local.id))?.deletedAt).toBe(plus(foreign.updatedAt, 1));
  });

  it('a tombstoned backup row never kills the live local entry', async () => {
    const t = freshRepo();
    const p = await t.repo.profiles.create({ name: 'A' });
    const local = await t.repo.arsenal.add(p.id, 'bench');
    const base = await t.repo.exportBackup(p.id);
    const dead = { ...local, id: 'gone', deletedAt: plus(local.updatedAt, 1000), updatedAt: plus(local.updatedAt, 1000) };
    await t.repo.importBackup({ ...base, arsenal: [dead] });
    expect((await t.repo.arsenal.list(p.id)).map((a) => a.id)).toEqual([local.id]);
  });
});
