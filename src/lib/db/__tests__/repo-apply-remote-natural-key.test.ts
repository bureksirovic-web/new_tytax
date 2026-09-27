/**
 * applyRemote keeps one live note / arsenal row per (profileId, exerciseId)
 * when the pulled row's id differs from the local one
 * (src/lib/db/repo/natural-key.ts, apply-remote.ts).
 */
import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { fakeSync, freshRepo, type TestRepo } from './helpers';

const plus = (iso: string, ms: number): string => new Date(Date.parse(iso) + ms).toISOString();

async function liveNotes(t: TestRepo, profileId: string) {
  return (await t.db.exerciseNotes.where('[profileId+exerciseId]').equals([profileId, 'bench']).toArray()).filter((n) => !n.deletedAt);
}

async function withLocalNote() {
  const t = freshRepo({ sync: fakeSync(true) });
  const p = await t.repo.profiles.create({ name: 'A' });
  const local = await t.repo.notes.set(p.id, 'bench', 'local text');
  if (!local) throw new Error('note not created');
  return { t, p, local };
}

describe('applyRemote: exercise notes with a different id for the same key', () => {
  it('a newer remote row wins and the local row is tombstoned without queueing', async () => {
    const { t, p, local } = await withLocalNote();
    const queued = await t.repo.outbox.count();
    const remote = { ...local, id: 'remote-note', content: 'remote text', updatedAt: plus(local.updatedAt, 1000) };

    expect(await t.repo.applyRemote('exercise_notes', [remote])).toEqual({ applied: 1, skipped: 0 });
    expect((await liveNotes(t, p.id)).map((n) => [n.id, n.content])).toEqual([['remote-note', 'remote text']]);
    expect((await t.db.exerciseNotes.get(local.id))?.deletedAt).toBe(plus(remote.updatedAt, 1));
    expect(await t.repo.outbox.count()).toBe(queued);

    expect(await t.repo.applyRemote('exercise_notes', [remote])).toEqual({ applied: 0, skipped: 1 });
    expect(await liveNotes(t, p.id)).toHaveLength(1);
  });

  it('an older remote row is stored as a tombstone; the local row stays live', async () => {
    const { t, p, local } = await withLocalNote();
    const remote = { ...local, id: 'remote-note', content: 'stale', updatedAt: plus(local.updatedAt, -1000) };

    expect(await t.repo.applyRemote('exercise_notes', [remote])).toEqual({ applied: 1, skipped: 0 });
    expect((await liveNotes(t, p.id)).map((n) => n.id)).toEqual([local.id]);
    const stored = await t.db.exerciseNotes.get('remote-note');
    expect(stored?.deletedAt).toBe(plus(local.updatedAt, 1));
    expect(stored?.updatedAt).toBe(stored?.deletedAt);
  });

  it('two devices resolving the same pair end with identical rows', async () => {
    const x = await withLocalNote();
    const other = { ...x.local, id: 'zz-remote', content: 'y text', updatedAt: plus(x.local.updatedAt, 500) };
    const y = freshRepo();
    await y.repo.applyRemote('profiles', [{ ...x.p }]);
    await y.repo.applyRemote('exercise_notes', [other]);

    await x.t.repo.applyRemote('exercise_notes', [other]);
    await y.repo.applyRemote('exercise_notes', [{ ...x.local }]);

    const rows = async (t: TestRepo) => (await t.db.exerciseNotes.toArray()).sort((a, b) => a.id.localeCompare(b.id));
    expect(await rows(y)).toEqual(await rows(x.t));
    expect(await liveNotes(y, x.p.id)).toHaveLength(1);
  });

  it('a remote tombstone for another id leaves the live local row alone', async () => {
    const { t, p, local } = await withLocalNote();
    const dead = { ...local, id: 'remote-note', deletedAt: plus(local.updatedAt, 1000), updatedAt: plus(local.updatedAt, 1000) };
    await t.repo.applyRemote('exercise_notes', [dead]);
    expect((await liveNotes(t, p.id)).map((n) => n.id)).toEqual([local.id]);
  });
});

describe('applyRemote: arsenal entries with a different id for the same key', () => {
  it('keeps exactly one live entry, the newer one', async () => {
    const t = freshRepo();
    const p = await t.repo.profiles.create({ name: 'A' });
    const local = await t.repo.arsenal.add(p.id, 'bench');
    const remote = { ...local, id: 'remote-arsenal', updatedAt: plus(local.updatedAt, 1000) };

    await t.repo.applyRemote('arsenal', [remote]);
    expect((await t.repo.arsenal.list(p.id)).map((a) => a.id)).toEqual(['remote-arsenal']);
    await t.repo.arsenal.remove(p.id, 'bench');
    expect(await t.repo.arsenal.has(p.id, 'bench')).toBe(false);
  });
});
