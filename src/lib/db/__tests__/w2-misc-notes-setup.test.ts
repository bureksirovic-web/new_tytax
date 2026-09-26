/** Wave 2 item 5: machine setup on exercise notes (NotesRepoExt, G2-W2-01). */
import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import type { MachineSetup, Repository } from '@/contracts';
import { getNotesExt, normalizeSetup } from '..';
import { expectCode, fakeSync, freshRepo } from './helpers';

async function setupRepo() {
  const t = freshRepo({ sync: fakeSync() });
  const p = await t.repo.profiles.create({ name: 'Ana' });
  return { ...t, p, notes: getNotesExt(t.repo) };
}

describe('notes.setSetup / getSetup', () => {
  it('creates a setup-only note, trims fields and reads it back as a copy', async () => {
    const { p, notes, repo } = await setupRepo();
    const note = await notes.setSetup(p.id, 'smith-squat', { seat: ' 4 ', pin: '7', benchAngle: '30°' });
    // trimmed ' 4 ' -> '4'; content of a setup-only note is ''
    expect(note).toMatchObject({ profileId: p.id, exerciseId: 'smith-squat', content: '', setup: { seat: '4', pin: '7', benchAngle: '30°' } });
    expect(await notes.getSetup(p.id, 'smith-squat')).toEqual({ seat: '4', pin: '7', benchAngle: '30°' });
    expect((await repo.notes.get(p.id, 'smith-squat'))?.setup).toEqual({ seat: '4', pin: '7', benchAngle: '30°' });
    const copy = await notes.getSetup(p.id, 'smith-squat');
    if (copy) copy.seat = 'mutated';
    expect((await notes.getSetup(p.id, 'smith-squat'))?.seat).toBe('4');
  });

  it('keeps the setup when the text changes, and the text when the setup changes', async () => {
    const { p, notes, repo } = await setupRepo();
    await repo.notes.set(p.id, 'row', 'slow eccentric');
    await notes.setSetup(p.id, 'row', { cable: 'low' });
    await repo.notes.set(p.id, 'row', 'pause at chest');
    expect(await repo.notes.get(p.id, 'row')).toMatchObject({ content: 'pause at chest', setup: { cable: 'low' } });
    await notes.setSetup(p.id, 'row', { other: 'wide grip' });
    // setSetup replaces the whole setup: cable is gone
    expect(await repo.notes.get(p.id, 'row')).toMatchObject({ content: 'pause at chest', setup: { other: 'wide grip' } });
  });

  it("empty content no longer deletes a note that still has a setup; clearing both deletes it", async () => {
    const { p, notes, repo } = await setupRepo();
    await repo.notes.set(p.id, 'dip', 'lean forward');
    await notes.setSetup(p.id, 'dip', { pin: '3' });
    const kept = await repo.notes.set(p.id, 'dip', '');
    expect(kept).toMatchObject({ content: '', setup: { pin: '3' } });
    expect(kept?.deletedAt).toBeUndefined();
    expect(await notes.setSetup(p.id, 'dip', null)).toBeUndefined();
    expect(await repo.notes.get(p.id, 'dip')).toBeUndefined();
    expect(await notes.getSetup(p.id, 'dip')).toBeUndefined();
    // one row, tombstoned
    expect(await repo.notes.list(p.id, { includeDeleted: true })).toHaveLength(1);
  });

  it('clearing the setup of a note with text keeps the text and drops the field', async () => {
    const { p, notes, repo } = await setupRepo();
    await repo.notes.set(p.id, 'curl', 'no swing');
    await notes.setSetup(p.id, 'curl', { seat: '2' });
    const note = await notes.setSetup(p.id, 'curl', {});
    expect(note?.content).toBe('no swing');
    expect(note && 'setup' in note).toBe(false);
  });

  it('a revived tombstone does not bring back its old setup', async () => {
    const { p, notes, repo } = await setupRepo();
    await notes.setSetup(p.id, 'fly', { seat: '5' });
    await notes.setSetup(p.id, 'fly', null);
    const revived = await repo.notes.set(p.id, 'fly', 'new text');
    expect(revived?.content).toBe('new text');
    expect(revived?.setup).toBeUndefined();
  });

  it('queues one upsert per write for sync', async () => {
    const { p, notes, repo } = await setupRepo();
    const before = await repo.outbox.count();
    await notes.setSetup(p.id, 'press', { pin: '1' });
    await notes.setSetup(p.id, 'press', { pin: '2' });
    // 2 writes -> 2 more outbox rows
    expect(await repo.outbox.count()).toBe(before + 2);
  });

  it('rejects unknown keys, empty or long values and non-objects with VALIDATION', async () => {
    const { p, notes } = await setupRepo();
    const bad: unknown[] = [{ height: '3' }, { seat: '' }, { seat: '   ' }, { pin: 4 }, { other: 'x'.repeat(41) }, 'seat 4', ['4']];
    for (const setup of bad) await expectCode(notes.setSetup(p.id, 'squat', setup as MachineSetup), 'VALIDATION');
    await expectCode(notes.setSetup(p.id, '', { seat: '1' }), 'VALIDATION');
    // exactly 40 characters is allowed
    expect((await notes.setSetup(p.id, 'squat', { other: 'x'.repeat(40) }))?.setup?.other).toHaveLength(40);
    expect(await notes.getSetup(p.id, 'none-yet')).toBeUndefined();
  });

  it('refuses a missing profile with NOT_FOUND', async () => {
    const { notes } = await setupRepo();
    await expectCode(notes.setSetup('ghost', 'squat', { seat: '1' }), 'NOT_FOUND');
  });

  it('normalizeSetup drops undefined fields and returns undefined when nothing is left', () => {
    expect(normalizeSetup({ seat: undefined, pin: '2' })).toEqual({ pin: '2' });
    expect(normalizeSetup({ seat: undefined })).toBeUndefined();
    expect(normalizeSetup(null)).toBeUndefined();
  });

  it('getNotesExt throws NOT_IMPLEMENTED for a contract-only repository', async () => {
    const { repo } = await setupRepo();
    const bare: Pick<Repository, 'notes'> = { notes: { get: repo.notes.get, set: repo.notes.set, list: repo.notes.list } };
    expect(() => getNotesExt(bare)).toThrowError(/not available/);
  });

  it('survives exportBackup -> importBackup into a fresh device', async () => {
    const { p, notes, repo } = await setupRepo();
    await notes.setSetup(p.id, 'hack-squat', { backrest: '2', cable: 'high' });
    const dst = freshRepo();
    await dst.repo.importBackup(await repo.exportBackup(p.id));
    expect(await getNotesExt(dst.repo).getSetup(p.id, 'hack-squat')).toEqual({ backrest: '2', cable: 'high' });
  });
});
