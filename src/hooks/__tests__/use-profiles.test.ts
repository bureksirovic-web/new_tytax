import 'fake-indexeddb/auto';
import { describe, it, expect, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { RepoError, type Repository } from '@/contracts/repo';
import { freshRepo } from '@/lib/db/__tests__/helpers';

const holder = vi.hoisted(() => ({ repo: undefined as unknown }));

vi.mock('@/lib/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/db')>();
  return { ...actual, getRepository: () => holder.repo };
});

const { useActiveProfile } = await import('../use-repo');
const { useProfiles, toRepoError } = await import('../use-profiles');
const { useProfileActions } = await import('../use-profile-actions');

function installRepo(): Repository {
  const { repo } = freshRepo();
  holder.repo = repo;
  return repo;
}

function useAll() {
  return { list: useProfiles(), active: useActiveProfile(), actions: useProfileActions() };
}

async function rejection(p: Promise<unknown>): Promise<RepoError> {
  const caught: unknown = await p.then(
    () => undefined,
    (e: unknown) => e,
  );
  expect(caught).toBeInstanceOf(RepoError);
  return caught as RepoError;
}

describe('useProfiles + useProfileActions', () => {
  it('create/rename/switch/remove update the live list and the active profile', async () => {
    installRepo();
    const { result } = renderHook(() => useAll());
    await waitFor(() => expect(result.current.list.loading).toBe(false));
    expect(result.current.list.profiles).toEqual([]);

    const a = await act(() => result.current.actions.create('Ana'));
    const b = await act(() => result.current.actions.create('Bruno', { units: 'lb' }));
    await waitFor(() => expect(result.current.list.profiles.map((p) => p.name)).toEqual(['Ana', 'Bruno']));
    expect(b.settings.units).toBe('lb');
    // create never activates
    expect(result.current.active.profileId).toBeUndefined();

    await act(() => result.current.actions.switchTo(a.id));
    await waitFor(() => expect(result.current.active.profileId).toBe(a.id));
    await act(() => result.current.actions.switchTo(b.id));
    await waitFor(() => expect(result.current.active.profile?.name).toBe('Bruno'));

    const renamed = await act(() => result.current.actions.rename(b.id, '  Bruno 2 '));
    expect(renamed.name).toBe('Bruno 2');
    await waitFor(() => expect(result.current.active.profile?.name).toBe('Bruno 2'));

    const tuned = await act(() => result.current.actions.updateSettings(b.id, { restSeconds: 120 }));
    expect(tuned.settings.restSeconds).toBe(120);
    expect(tuned.settings.units).toBe('lb');

    // removing the active profile: list shrinks live, the remaining one becomes active
    await act(() => result.current.actions.remove(b.id));
    await waitFor(() => expect(result.current.list.profiles.map((p) => p.id)).toEqual([a.id]));
    await waitFor(() => expect(result.current.active.profileId).toBe(a.id));
    expect(result.current.list.error).toBeUndefined();
  });

  it('removing a non-active profile keeps the active one', async () => {
    const repo = installRepo();
    const a = await repo.profiles.create({ name: 'A' });
    const b = await repo.profiles.create({ name: 'B' });
    await repo.profiles.setActive(a.id);
    const { result } = renderHook(() => useAll());
    await waitFor(() => expect(result.current.list.profiles).toHaveLength(2));

    await act(() => result.current.actions.remove(b.id));
    await waitFor(() => expect(result.current.list.profiles).toHaveLength(1));
    expect(result.current.active.profileId).toBe(a.id);
    expect(await repo.profiles.get(b.id)).toBeUndefined();
  });

  it('surfaces failures as RepoError with a typed code', async () => {
    installRepo();
    const { result } = renderHook(() => useProfileActions());

    expect((await rejection(result.current.create('   '))).code).toBe('VALIDATION');
    expect((await rejection(result.current.rename('missing', 'X'))).code).toBe('NOT_FOUND');
    expect((await rejection(result.current.switchTo('missing'))).code).toBe('NOT_FOUND');
    expect((await rejection(result.current.remove('missing'))).code).toBe('NOT_FOUND');
    const bad = result.current.updateSettings('missing', { restSeconds: -1 });
    expect((await rejection(bad)).code).toBe('NOT_FOUND');
  });

  it('keeps the actions object stable across renders', () => {
    installRepo();
    const { result, rerender } = renderHook(() => useProfileActions());
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });

  it('reports a failing list query as a RepoError', async () => {
    const repo = installRepo();
    vi.spyOn(repo.profiles, 'list').mockRejectedValue(new Error('disk gone'));
    const { result } = renderHook(() => useProfiles());
    await waitFor(() => expect(result.current.error).toBeDefined());
    expect(result.current.error?.code).toBe('STORAGE');
    expect(result.current.error?.message).toBe('disk gone');
    expect(result.current.profiles).toEqual([]);
  });
});

describe('toRepoError', () => {
  it('passes RepoErrors through and wraps anything else as STORAGE', () => {
    const original = new RepoError('CONFLICT', 'dup');
    expect(toRepoError(original)).toBe(original);
    const wrapped = toRepoError('plain string');
    expect(wrapped.code).toBe('STORAGE');
    expect(wrapped.message).toBe('plain string');
    expect(wrapped.cause).toBe('plain string');
  });
});
