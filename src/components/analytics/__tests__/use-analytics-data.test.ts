import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { DEFAULT_PROFILE_SETTINGS, type ProfileSettings } from '@/contracts/domain';
import { RepoError, type Repository } from '@/contracts/repo';
import { createRepository, TytaxDatabase } from '@/lib/db';
import { loadCatalog } from '@/lib/catalog';
import { deleteBodyweight, saveBodyweight } from '../bodyweight-actions';
import { seedLog } from './helpers';

const holder = vi.hoisted(() => ({ repo: undefined as unknown }));

vi.mock('@/lib/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/db')>();
  return { ...actual, getRepository: () => holder.repo };
});

const { useAnalyticsData, useExerciseHistory, usePinnedExercises, localDayDaysAgo, readPins, readStoredPins, pinsStorageKey, savePins, MAX_PINNED } =
  await import('../use-analytics-data');

const SWING = 'kb_swing_two-hand-swing';

let n = 0;
function installRepo(): Repository {
  n += 1;
  const repo = createRepository({ db: new TytaxDatabase(`analytics-${n}`) });
  holder.repo = repo;
  return repo;
}

describe('localDayDaysAgo', () => {
  it('counts local calendar days back from now', () => {
    // 2026-03-10 local noon − 7 days = 2026-03-03
    expect(localDayDaysAgo(7, new Date(2026, 2, 10, 12))).toBe('2026-03-03');
    // across a month boundary: 2026-03-02 − 3 days = 2026-02-27
    expect(localDayDaysAgo(3, new Date(2026, 2, 2, 12))).toBe('2026-02-27');
  });
});

describe('useAnalyticsData / useExerciseHistory', () => {
  it('reads only the active profile live logs (whole history, newest first) and names from the lazy catalog', async () => {
    const repo = installRepo();
    const me = await repo.profiles.ensureActive('Me');
    await repo.profiles.updateSettings(me.id, { units: 'lb' });
    const other = await repo.profiles.create({ name: 'Other' });
    await seedLog(repo, me.id, 'a', 10, SWING, [{ kg: 20, reps: 10 }]);
    await seedLog(repo, me.id, 'b', 3, SWING, [{ kg: 24, reps: 8 }]);
    await seedLog(repo, me.id, 'c', 100, SWING, [{ kg: 30, reps: 5 }]);
    await seedLog(repo, me.id, 'gone', 1, SWING, [{ kg: 99, reps: 5 }]);
    await repo.logs.softDelete(me.id, 'gone');
    await seedLog(repo, other.id, 'x', 2, SWING, [{ kg: 48, reps: 5 }]);
    const swingName = (await loadCatalog()).getById(SWING)?.name;
    expect(swingName).toBeTruthy();

    const { result } = renderHook(() => useAnalyticsData());
    await waitFor(() => expect(result.current.loading).toBe(false));
    // soft-deleted 'gone' and the other profile's 'x' are hidden; 100-day-old 'c' is kept (whole history)
    expect(result.current.logs.map((l) => l.id)).toEqual(['b', 'a', 'c']);
    expect(result.current.units).toBe('lb');
    await waitFor(() => expect(result.current.catalogLoading).toBe(false));
    expect(result.current.nameOf(SWING)).toBe(swingName);
    expect(result.current.nameOf('custom-x', 'My custom')).toBe('My custom');
    expect(result.current.lookup(SWING)?.id).toBe(SWING);

    const single = renderHook(() => useExerciseHistory(SWING));
    await waitFor(() => expect(single.result.current.loading).toBe(false));
    expect(single.result.current.logs.map((l) => l.id)).toEqual(['b', 'a', 'c']);
  });
});

describe('pinned exercises', () => {
  beforeEach(() => localStorage.clear());

  it('persist per profile, deduplicated and capped at 4, without disturbing other settings', async () => {
    const repo = installRepo();
    const me = await repo.profiles.ensureActive('Me');
    const other = await repo.profiles.create({ name: 'Other' });
    await savePins(repo, me.id, ['a', 'b', 'a', 'c', 'd', 'e']);
    expect(MAX_PINNED).toBe(4);
    // read back through a fresh repository fetch
    expect(readPins((await repo.profiles.get(me.id))!.settings, me.id)).toEqual(['a', 'b', 'c', 'd']);
    // exactly one store holds them: settings when the repository keeps the key, else the localStorage fallback
    const kept = (await repo.profiles.get(me.id))!.settings.pinnedExerciseIds;
    expect(kept ?? readStoredPins(me.id)).toEqual(['a', 'b', 'c', 'd']);
    expect(localStorage.getItem(pinsStorageKey(me.id)) === null).toBe(kept !== undefined);
    expect(readPins((await repo.profiles.get(other.id))!.settings, other.id)).toEqual([]);
    expect(readStoredPins(other.id)).toEqual([]);
    // other settings survive
    expect((await repo.profiles.get(me.id))!.settings.units).toBe('kg');
    expect(readPins(undefined)).toEqual([]);

    // the other profile's own pins do not leak into mine
    await savePins(repo, other.id, ['z']);
    expect(readPins((await repo.profiles.get(other.id))!.settings, other.id)).toEqual(['z']);
    expect(readPins((await repo.profiles.get(me.id))!.settings, me.id)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('a settings pinnedExerciseIds array (future contract) wins over localStorage and is sanitised', () => {
    localStorage.setItem(pinsStorageKey('p1'), JSON.stringify(['stored']));
    const settings = { ...DEFAULT_PROFILE_SETTINGS, pinnedExerciseIds: ['x', 'x', 7, '', 'y', 'z', 'w', 'v'] } as unknown as ProfileSettings;
    expect(readPins(settings, 'p1')).toEqual(['x', 'y', 'z', 'w']);
    expect(readPins(DEFAULT_PROFILE_SETTINGS, 'p1')).toEqual(['stored']);
  });

  it('corrupt or wrongly-shaped stored values read as no pins', () => {
    localStorage.setItem(pinsStorageKey('p1'), '{not json');
    expect(readStoredPins('p1')).toEqual([]);
    localStorage.setItem(pinsStorageKey('p1'), JSON.stringify({ ids: ['a'] }));
    expect(readStoredPins('p1')).toEqual([]);
    localStorage.setItem(pinsStorageKey('p1'), JSON.stringify(['a', 3, null, 'a', 'b']));
    expect(readStoredPins('p1')).toEqual(['a', 'b']);
  });

  it('a VALIDATION rejection of the settings key does not surface; other repository errors do', async () => {
    const repo = installRepo();
    const me = await repo.profiles.ensureActive('Me');
    const reject = (code: 'VALIDATION' | 'NOT_FOUND') =>
      vi.spyOn(repo.profiles, 'updateSettings').mockRejectedValueOnce(new RepoError(code, 'settings.pinnedExerciseIds is not a known setting'));
    reject('VALIDATION');
    await expect(savePins(repo, me.id, ['a'])).resolves.toBeUndefined();
    expect(readStoredPins(me.id)).toEqual(['a']);
    reject('NOT_FOUND');
    await expect(savePins(repo, me.id, ['b'])).rejects.toThrow(RepoError);
    vi.restoreAllMocks();
  });

  it('usePinnedExercises updates after a save and survives a remount, per active profile', async () => {
    const repo = installRepo();
    const me = await repo.profiles.ensureActive('Me');
    const other = await repo.profiles.create({ name: 'Other' });

    const first = renderHook(() => usePinnedExercises());
    await waitFor(() => expect(first.result.current.profileId).toBe(me.id));
    expect(first.result.current.pins).toEqual([]);
    await savePins(repo, me.id, ['b', 'a']);
    await waitFor(() => expect(first.result.current.pins).toEqual(['b', 'a']));
    first.unmount();

    const again = renderHook(() => usePinnedExercises());
    await waitFor(() => expect(again.result.current.profileId).toBe(me.id));
    expect(again.result.current.pins).toEqual(['b', 'a']);

    await repo.profiles.setActive(other.id);
    await waitFor(() => expect(again.result.current.profileId).toBe(other.id));
    expect(again.result.current.pins).toEqual([]);
    again.unmount();
  });
});

describe('saveBodyweight', () => {
  it('upserts one entry per day and keeps profile.bodyweightKg on the latest entry', async () => {
    const repo = installRepo();
    const me = await repo.profiles.ensureActive('Me');
    const list = () => repo.bodyweight.list(me.id);

    await saveBodyweight(repo, me.id, await list(), { date: '2026-09-20', valueKg: 80 });
    await saveBodyweight(repo, me.id, await list(), { date: '2026-09-20', valueKg: 81 });
    expect((await list()).map((e) => [e.date, e.valueKg])).toEqual([['2026-09-20', 81]]);
    expect((await repo.profiles.get(me.id))!.bodyweightKg).toBe(81);

    // an older entry does not overwrite the current bodyweight
    await saveBodyweight(repo, me.id, await list(), { date: '2026-09-10', valueKg: 83 });
    expect((await repo.profiles.get(me.id))!.bodyweightKg).toBe(81);

    // editing the 09-10 entry onto 09-20 merges into the 09-20 entry
    const older = (await list()).find((e) => e.date === '2026-09-10')!;
    await saveBodyweight(repo, me.id, await list(), { date: '2026-09-20', valueKg: 79.5, editingId: older.id });
    expect((await list()).map((e) => [e.date, e.valueKg])).toEqual([['2026-09-20', 79.5]]);

    // plain edit changes date and value in place
    const only = (await list())[0];
    await saveBodyweight(repo, me.id, await list(), { date: '2026-09-22', valueKg: 78, editingId: only.id });
    expect((await list()).map((e) => [e.id, e.date, e.valueKg])).toEqual([[only.id, '2026-09-22', 78]]);
    expect((await repo.profiles.get(me.id))!.bodyweightKg).toBe(78);
  });
});

describe('profile bodyweight follows the newest entry', () => {
  it('after moving the newest entry to an older date, and after deleting the newest entry', async () => {
    const repo = installRepo();
    const me = await repo.profiles.ensureActive('Me');
    const list = () => repo.bodyweight.list(me.id);
    const bw = async () => (await repo.profiles.get(me.id))!.bodyweightKg;

    await saveBodyweight(repo, me.id, await list(), { date: '2026-09-10', valueKg: 82 });
    await saveBodyweight(repo, me.id, await list(), { date: '2026-09-20', valueKg: 80 });
    expect(await bw()).toBe(80);

    // edit the 09-20 entry (80) to 09-01 / 85: the newest is now 09-10 (82), not the edited value
    const newest = (await list())[0];
    await saveBodyweight(repo, me.id, await list(), { date: '2026-09-01', valueKg: 85, editingId: newest.id });
    expect((await list()).map((e) => [e.date, e.valueKg])).toEqual([['2026-09-10', 82], ['2026-09-01', 85]]);
    expect(await bw()).toBe(82);

    // delete the newest (09-10, 82): falls back to 09-01 (85)
    await deleteBodyweight(repo, me.id, (await list())[0].id);
    expect((await list()).map((e) => e.valueKg)).toEqual([85]);
    expect(await bw()).toBe(85);
  });
});
