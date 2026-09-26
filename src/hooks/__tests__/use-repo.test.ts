import 'fake-indexeddb/auto';
import { describe, it, expect, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { Repository } from '@/contracts/repo';
import { createRepository, TytaxDatabase } from '@/lib/db';

const holder = vi.hoisted(() => ({ repo: undefined as unknown }));

vi.mock('@/lib/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/db')>();
  return { ...actual, getRepository: () => holder.repo };
});

const { useActiveProfile, useRepoQuery } = await import('../use-repo');
const { useHistory } = await import('../use-history');

let n = 0;
function installRepo(): Repository {
  n += 1;
  const repo = createRepository({ db: new TytaxDatabase(`use-repo-${n}`) });
  holder.repo = repo;
  return repo;
}

function finishedDraft(id: string, profileId: string, day: number) {
  const startedAt = new Date(2026, 2, day, 12).toISOString();
  return {
    id,
    profileId,
    sessionName: `S${day}`,
    startedAt,
    exercises: [{ uid: `u-${id}`, exerciseId: 'bench', exerciseName: 'Bench', modality: 'tytax' as const, sets: [{ id: `s-${id}`, type: 'working' as const, kg: 50, reps: 5, done: true }] }],
  };
}

describe('useActiveProfile', () => {
  it('is loading first, then follows the active profile live', async () => {
    const repo = installRepo();
    const { result } = renderHook(() => useActiveProfile());
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.profile).toBeUndefined();

    const p = await act(() => repo.profiles.ensureActive('Me'));
    await waitFor(() => expect(result.current.profileId).toBe(p.id));
    expect(result.current.profile?.name).toBe('Me');
  });
});

describe('useRepoQuery', () => {
  it('re-subscribes when deps change and never shows the previous deps result', async () => {
    const repo = installRepo();
    const a = await repo.profiles.create({ name: 'A' });
    const b = await repo.profiles.create({ name: 'B' });
    const { result, rerender, unmount } = renderHook(({ id }) => useRepoQuery((r) => r.profiles.get(id), [id]), { initialProps: { id: a.id } });
    await waitFor(() => expect(result.current.data?.name).toBe('A'));

    rerender({ id: b.id });
    expect(result.current.data).toBeUndefined();
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.data?.name).toBe('B'));
    unmount();
  });
});

describe('useHistory', () => {
  it('pages the active profile logs newest first', async () => {
    const repo = installRepo();
    const p = await repo.profiles.ensureActive('Me');
    for (const day of [1, 2, 3]) await repo.finishWorkout(finishedDraft(`w${day}`, p.id, day));

    const { result } = renderHook(() => useHistory(2));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.logs.map((l) => l.id)).toEqual(['w3', 'w2']);
    // 3 logs, page size 2: page 0 shows 2, 3 > (0 + 1)·2 → hasMore
    expect(result.current.total).toBe(3);
    expect(result.current.hasMore).toBe(true);

    act(() => result.current.nextPage());
    await waitFor(() => expect(result.current.logs.map((l) => l.id)).toEqual(['w1']));
    // 3 > (1 + 1)·2 = 4 is false → no more pages
    expect(result.current.hasMore).toBe(false);
  });
});
