import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { MachineSetup } from '@/contracts/domain';
import type { Repository } from '@/contracts/repo';
import { createRepository, TytaxDatabase } from '@/lib/db';
import { canSaveSetup, cleanSetup, loadSetup, saveSetup, SETUP_FIELD_MAX } from '../setup-adapter';

let n = 0;
let repo: Repository;
let profileId: string;

/** A repository whose notes gained G2's writer (as after integration), backed by an in-memory map. */
function withNotesWriter(base: Repository): { repo: Repository; store: Map<string, MachineSetup | null> } {
  const store = new Map<string, MachineSetup | null>();
  const notes = Object.assign(Object.create(base.notes) as object, {
    setSetup: vi.fn(async (p: string, e: string, s: MachineSetup | null) => {
      store.set(`${p}/${e}`, s);
    }),
    getSetup: vi.fn(async (p: string, e: string) => store.get(`${p}/${e}`) ?? undefined),
  });
  return { repo: { ...base, notes } as unknown as Repository, store };
}

describe('setup adapter', () => {
  beforeEach(async () => {
    n += 1;
    repo = createRepository({ db: new TytaxDatabase(`setup-${n}`) });
    profileId = (await repo.profiles.ensureActive('Me')).id;
  });

  it('cleanSetup trims, caps and drops empty fields', () => {
    // G2's notes repo rejects setup fields longer than 40 characters.
    expect(SETUP_FIELD_MAX).toBe(40);
    expect(cleanSetup(undefined)).toBeUndefined();
    expect(cleanSetup({ seat: '  ', pin: '' })).toBeUndefined();
    expect(cleanSetup({ seat: ' 4 ', benchAngle: '30°', other: 'x'.repeat(80) })).toEqual({
      seat: '4', benchAngle: '30°', other: 'x'.repeat(40),
    });
    expect(cleanSetup({ cable: 5 as unknown as string, backrest: '2' })).toEqual({ backrest: '2' });
  });

  it('on the Wave-1 repository: reads note.setup, and save is unsupported (nothing written)', async () => {
    expect(canSaveSetup(repo)).toBe(false);
    expect(await loadSetup(repo, profileId, 'bench')).toBeUndefined();
    await repo.notes.set(profileId, 'bench', 'elbows in');
    const res = await saveSetup(repo, profileId, 'bench', { seat: '3' });
    expect(res).toEqual({ saved: false, reason: 'unsupported' });
    const note = await repo.notes.get(profileId, 'bench');
    expect(note?.content).toBe('elbows in');
    expect(note?.setup).toBeUndefined();
  });

  it('reads a setup stored on the note row', async () => {
    const fake = {
      ...repo,
      notes: { ...repo.notes, get: async () => ({ id: 'n', profileId, exerciseId: 'bench', content: '', setup: { pin: ' 7 ' }, createdAt: '', updatedAt: '' }) },
    } as Repository;
    expect(await loadSetup(fake, profileId, 'bench')).toEqual({ pin: '7' });
  });

  it('uses notes.setSetup / notes.getSetup when the implementation has them', async () => {
    const { repo: r, store } = withNotesWriter(repo);
    expect(canSaveSetup(r)).toBe(true);
    const res = await saveSetup(r, profileId, 'bench', { seat: ' 4 ', pin: '' });
    expect(res).toEqual({ saved: true, setup: { seat: '4' } });
    expect(store.get(`${profileId}/bench`)).toEqual({ seat: '4' });
    expect(await loadSetup(r, profileId, 'bench')).toEqual({ seat: '4' });
    // Clearing every field writes null (G2's `setSetup(.., null)` clear).
    expect(await saveSetup(r, profileId, 'bench', { seat: '' })).toEqual({ saved: true, setup: undefined });
    expect(store.get(`${profileId}/bench`)).toBeNull();
    expect(await loadSetup(r, profileId, 'bench')).toBeUndefined();
  });

  it('reports writer errors (e.g. G2 VALIDATION) and reads through notes.getSetup', async () => {
    const err = new Error('boom');
    const notes = Object.assign(Object.create(repo.notes) as object, {
      setSetup: vi.fn(async () => { throw err; }),
      getSetup: vi.fn(async () => ({ cable: 'rope' })),
    });
    const r = { ...repo, notes } as unknown as Repository;
    expect(canSaveSetup(r)).toBe(true);
    // A repo-level pair is not G2's shape: not a writer.
    expect(canSaveSetup({ ...repo, setSetup: vi.fn(), getSetup: vi.fn() } as unknown as Repository)).toBe(false);
    expect(await saveSetup(r, profileId, 'bench', { cable: 'rope' })).toEqual({ saved: false, reason: 'error', error: err });
    expect(await loadSetup(r, profileId, 'bench')).toEqual({ cable: 'rope' });
  });
});
