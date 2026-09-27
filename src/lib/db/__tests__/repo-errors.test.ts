import 'fake-indexeddb/auto';
import { describe, it, expect, vi, afterEach } from 'vitest';
import Dexie from 'dexie';
import { RepoError, isRepoError } from '@/contracts/repo';
import { newUuid } from '../ids';
import { createRepository, requireActiveProfile } from '../repository';
import { isStorageError, toRepoError } from '../repo/errors';
import { TytaxDatabase } from '../dexie';
import { expectCode, freshRepo } from './helpers';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('typed storage errors', () => {
  it('a duplicate primary key (ConstraintError) becomes STORAGE with the cause kept', async () => {
    const db = new TytaxDatabase(`dup-${Math.random().toString(36).slice(2)}`);
    const repo = createRepository({ db, newId: () => 'same-id' });
    await repo.profiles.create({ name: 'A' });
    const err = await repo.profiles.create({ name: 'B' }).catch((e: unknown) => e);
    expect(isRepoError(err, 'STORAGE')).toBe(true);
    expect((err as RepoError).cause).toBeInstanceOf(Dexie.ConstraintError);
    expect(await repo.profiles.list()).toHaveLength(1);
  });

  it('QuotaExceeded on a write is STORAGE and rolls the write back', async () => {
    const { repo, db } = freshRepo();
    const p = await repo.profiles.create({ name: 'A' });
    vi.spyOn(db.bodyweightEntries, 'add').mockRejectedValue(new DOMException('full', 'QuotaExceededError'));
    await expectCode(repo.bodyweight.add(p.id, { date: '2026-03-01', valueKg: 70 }), 'STORAGE');
    vi.restoreAllMocks();
    expect(await repo.bodyweight.list(p.id, { includeDeleted: true })).toEqual([]);
  });

  it('reads on a closed database are STORAGE too', async () => {
    const { repo, db } = freshRepo();
    const p = await repo.profiles.create({ name: 'A' });
    db.close();
    await expectCode(repo.profiles.list(), 'STORAGE');
    await expectCode(repo.logs.list(p.id), 'STORAGE');
    await expectCode(repo.outbox.count(), 'STORAGE');
    await expectCode(repo.exportBackup(), 'STORAGE');
    await expectCode(repo.transaction(async () => undefined), 'STORAGE');
  });

  it('programming errors pass through untouched; RepoErrors keep their code', () => {
    const bug = new TypeError('x is undefined');
    expect(toRepoError(bug)).toBe(bug);
    const typed = new RepoError('NOT_FOUND', 'gone');
    expect(toRepoError(typed)).toBe(typed);
    expect(isStorageError('QuotaExceededError')).toBe(false);
    expect(isStorageError({ name: 'AbortError' })).toBe(true);
    const bare = toRepoError(Object.assign(new Error(''), { name: 'UnknownError' }));
    expect(isRepoError(bare, 'STORAGE') && bare.message).toBe('UnknownError');
  });
});

describe('requireActiveProfile', () => {
  it('throws NO_ACTIVE_PROFILE until a profile is active, then returns it', async () => {
    const { repo } = freshRepo();
    await expectCode(requireActiveProfile(repo), 'NO_ACTIVE_PROFILE');
    const p = await repo.profiles.create({ name: 'A' });
    await expectCode(requireActiveProfile(repo), 'NO_ACTIVE_PROFILE');
    await repo.profiles.setActive(p.id);
    expect((await requireActiveProfile(repo)).id).toBe(p.id);
    await repo.profiles.remove(p.id);
    await expectCode(requireActiveProfile(repo), 'NO_ACTIVE_PROFILE');
  });
});

describe('newUuid', () => {
  it('uses crypto.randomUUID when present', () => {
    const randomUUID = vi.fn(() => '00000000-0000-4000-8000-000000000000');
    vi.stubGlobal('crypto', { randomUUID });
    expect(newUuid()).toBe('00000000-0000-4000-8000-000000000000');
    expect(randomUUID).toHaveBeenCalledTimes(1);
  });

  it('falls back to getRandomValues and sets the v4 version and variant bits', () => {
    vi.stubGlobal('crypto', {
      getRandomValues: (bytes: Uint8Array) => {
        bytes.fill(0xff);
        return bytes;
      },
    });
    // all-ones bytes: byte 6 → 0x4f, byte 8 → 0xbf
    expect(newUuid()).toBe('ffffffff-ffff-4fff-bfff-ffffffffffff');
  });

  it('still returns a v4-shaped id with no crypto at all', () => {
    vi.stubGlobal('crypto', undefined);
    vi.spyOn(Math, 'random').mockReturnValue(0);
    // zero bytes: byte 6 → 0x40, byte 8 → 0x80
    expect(newUuid()).toBe('00000000-0000-4000-8000-000000000000');
    expect(newUuid()).toMatch(UUID_V4);
  });
});
