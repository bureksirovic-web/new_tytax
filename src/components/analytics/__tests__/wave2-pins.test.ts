import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { RepoError, isRepoError, type Repository } from '@/contracts/repo';
import { createRepository, TytaxDatabase } from '@/lib/db';

const holder = vi.hoisted(() => ({ repo: undefined as unknown }));

vi.mock('@/lib/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/db')>();
  return { ...actual, getRepository: () => holder.repo };
});

const { migrateStoredPins, pinsStorageKey, readPins, readStoredPins, savePins, usePinnedExercises } = await import('../pinned-storage');

let n = 0;
function installRepo(): Repository {
  n += 1;
  const repo = createRepository({ db: new TytaxDatabase(`analytics-pins-w2-${n}`) });
  holder.repo = repo;
  return repo;
}

/**
 * Whether this repository keeps `settings.pinnedExerciseIds` (G2 Wave 2) or
 * rejects it as an unknown setting (G2 Wave 1). Probed on a throwaway profile.
 */
async function acceptsPinsKey(repo: Repository): Promise<boolean> {
  const probe = await repo.profiles.create({ name: 'probe' });
  try {
    await repo.profiles.updateSettings(probe.id, { pinnedExerciseIds: ['p'] });
    return true;
  } catch (e) {
    if (isRepoError(e, 'VALIDATION')) return false;
    throw e;
  }
}

const rejectKey = (repo: Repository) =>
  vi.spyOn(repo.profiles, 'updateSettings').mockRejectedValue(new RepoError('VALIDATION', 'settings.pinnedExerciseIds is not a known setting'));

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('savePins: settings first, localStorage only when the repository rejects the key', () => {
  it('a VALIDATION rejection stores the pins locally (read back through readPins)', async () => {
    const repo = installRepo();
    const me = await repo.profiles.ensureActive('Me');
    rejectKey(repo);
    await savePins(repo, me.id, ['b', 'a', 'b']);
    expect(readStoredPins(me.id)).toEqual(['b', 'a']);
    expect(readPins((await repo.profiles.get(me.id))!.settings, me.id)).toEqual(['b', 'a']);
  });

  it('an accepted save removes a stale local copy; the real repository path is exact either way', async () => {
    const repo = installRepo();
    const me = await repo.profiles.ensureActive('Me');
    const accepts = await acceptsPinsKey(repo);
    localStorage.setItem(pinsStorageKey(me.id), JSON.stringify(['old']));
    await savePins(repo, me.id, ['x', 'y']);
    const settings = (await repo.profiles.get(me.id))!.settings;
    if (accepts) {
      expect(settings.pinnedExerciseIds).toEqual(['x', 'y']);
      expect(localStorage.getItem(pinsStorageKey(me.id))).toBeNull();
    } else {
      expect(settings.pinnedExerciseIds).toBeUndefined();
      expect(readStoredPins(me.id)).toEqual(['x', 'y']);
    }
    expect(readPins(settings, me.id)).toEqual(['x', 'y']);
  });
});

describe('migrateStoredPins', () => {
  it('settings already holding an array (even empty) win; the stale local key is removed', async () => {
    const repo = installRepo();
    const me = await repo.profiles.ensureActive('Me');
    localStorage.setItem(pinsStorageKey(me.id), JSON.stringify(['old']));
    const spy = vi.spyOn(repo.profiles, 'updateSettings');
    const settings = { ...(await repo.profiles.get(me.id))!.settings, pinnedExerciseIds: [] };
    await expect(migrateStoredPins(repo, me.id, settings)).resolves.toBe('none');
    expect(spy).not.toHaveBeenCalled();
    expect(localStorage.getItem(pinsStorageKey(me.id))).toBeNull();
    expect(readPins(settings, me.id)).toEqual([]);
  });

  it('a refusing repository keeps the local pins and never throws', async () => {
    const repo = installRepo();
    const me = await repo.profiles.ensureActive('Me');
    localStorage.setItem(pinsStorageKey(me.id), JSON.stringify(['a', 'b']));
    rejectKey(repo);
    await expect(migrateStoredPins(repo, me.id, (await repo.profiles.get(me.id))!.settings)).resolves.toBe('kept');
    expect(readStoredPins(me.id)).toEqual(['a', 'b']);
  });

  it('nothing stored → nothing to do', async () => {
    const repo = installRepo();
    const me = await repo.profiles.ensureActive('Me');
    const spy = vi.spyOn(repo.profiles, 'updateSettings');
    await expect(migrateStoredPins(repo, me.id, (await repo.profiles.get(me.id))!.settings)).resolves.toBe('none');
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('usePinnedExercises migrates existing localStorage pins into settings once', () => {
  it('real repository: moved into settings when accepted, else kept local and asked only once', async () => {
    const repo = installRepo();
    const me = await repo.profiles.ensureActive('Me');
    const accepts = await acceptsPinsKey(repo);
    await repo.profiles.setActive(me.id);
    localStorage.setItem(pinsStorageKey(me.id), JSON.stringify(['a', 'b']));
    const spy = vi.spyOn(repo.profiles, 'updateSettings');

    const hook = renderHook(() => usePinnedExercises());
    await waitFor(() => expect(hook.result.current.profileId).toBe(me.id));
    expect(hook.result.current.pins).toEqual(['a', 'b']);
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(1));
    expect(spy).toHaveBeenCalledWith(me.id, { pinnedExerciseIds: ['a', 'b'] });

    if (accepts) {
      await waitFor(async () => expect((await repo.profiles.get(me.id))!.settings.pinnedExerciseIds).toEqual(['a', 'b']));
      await waitFor(() => expect(localStorage.getItem(pinsStorageKey(me.id))).toBeNull());
    } else {
      expect(readStoredPins(me.id)).toEqual(['a', 'b']);
    }
    expect(hook.result.current.pins).toEqual(['a', 'b']);
    // a remount does not ask again for the same stored value
    hook.unmount();
    const again = renderHook(() => usePinnedExercises());
    await waitFor(() => expect(again.result.current.pins).toEqual(['a', 'b']));
    expect(spy).toHaveBeenCalledTimes(1);
    again.unmount();
  });
});
