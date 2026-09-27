import 'fake-indexeddb/auto';
import { describe, it, expect, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { Repository } from '@/contracts/repo';
import { draft, exercise, freshRepo } from '@/lib/db/__tests__/helpers';

const holder = vi.hoisted(() => ({ repo: undefined as unknown }));

vi.mock('@/lib/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/db')>();
  return { ...actual, getRepository: () => holder.repo };
});

const { useHistory } = await import('../use-history');

function installRepo(): Repository {
  const { repo } = freshRepo();
  holder.repo = repo;
  return repo;
}

async function finish(repo: Repository, id: string, profileId: string, day: number): Promise<void> {
  const startedAt = new Date(2026, 2, day, 12).toISOString();
  await repo.finishWorkout(draft(id, profileId, [exercise(`u-${id}`, 'bench', [{ kg: 50, reps: 5 }])], { startedAt }));
}

describe('useHistory', () => {
  it('is scoped to the active profile and restarts at page 0 on a switch', async () => {
    const repo = installRepo();
    const a = await repo.profiles.create({ name: 'A' });
    const b = await repo.profiles.create({ name: 'B' });
    for (const day of [1, 2, 3]) await finish(repo, `a${day}`, a.id, day);
    await finish(repo, 'b1', b.id, 5);
    await repo.profiles.setActive(a.id);

    const { result } = renderHook(() => useHistory(2));
    await waitFor(() => expect(result.current.logs.map((l) => l.id)).toEqual(['a3', 'a2']));
    act(() => result.current.nextPage());
    await waitFor(() => expect(result.current.logs.map((l) => l.id)).toEqual(['a1']));
    expect(result.current.page).toBe(1);

    await act(() => repo.profiles.setActive(b.id));
    await waitFor(() => expect(result.current.logs.map((l) => l.id)).toEqual(['b1']));
    expect(result.current.page).toBe(0);
    expect(result.current.total).toBe(1);
    expect(result.current.hasMore).toBe(false);
  });

  it('hides soft-deleted logs live and never pages below 0', async () => {
    const repo = installRepo();
    const p = await repo.profiles.ensureActive('Me');
    await finish(repo, 'w1', p.id, 1);
    await finish(repo, 'w2', p.id, 2);

    const { result } = renderHook(() => useHistory());
    await waitFor(() => expect(result.current.total).toBe(2));
    await act(() => repo.logs.softDelete(p.id, 'w2'));
    await waitFor(() => expect(result.current.logs.map((l) => l.id)).toEqual(['w1']));
    // 2 logs, 1 soft-deleted → 1 counted
    expect(result.current.total).toBe(1);

    act(() => result.current.prevPage());
    expect(result.current.page).toBe(0);
    expect(result.current.error).toBeUndefined();
  });

  it('is empty (not loading) when there is no active profile', async () => {
    installRepo();
    const { result } = renderHook(() => useHistory());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.logs).toEqual([]);
    expect(result.current.total).toBe(0);
  });

  it('reports a failing query instead of loading forever', async () => {
    const repo = installRepo();
    await repo.profiles.ensureActive('Me');
    vi.spyOn(repo.logs, 'count').mockRejectedValue(new Error('broken'));
    const { result } = renderHook(() => useHistory());
    await waitFor(() => expect(result.current.error).toBeInstanceOf(Error));
    expect(result.current.isLoading).toBe(false);
    expect(result.current.logs).toEqual([]);
  });

  it('forgets the page on any switch: A (page 1) -> B -> A reopens A at page 0', async () => {
    const repo = installRepo();
    const a = await repo.profiles.create({ name: 'A' });
    const b = await repo.profiles.create({ name: 'B' });
    for (const day of [1, 2, 3]) await finish(repo, `a${day}`, a.id, day);
    await finish(repo, 'b1', b.id, 5);
    await repo.profiles.setActive(a.id);

    const { result } = renderHook(() => useHistory(2));
    await waitFor(() => expect(result.current.logs.map((l) => l.id)).toEqual(['a3', 'a2']));
    act(() => result.current.nextPage());
    await waitFor(() => expect(result.current.logs.map((l) => l.id)).toEqual(['a1']));
    await act(() => repo.profiles.setActive(b.id));
    await waitFor(() => expect(result.current.logs.map((l) => l.id)).toEqual(['b1']));
    await act(() => repo.profiles.setActive(a.id));
    await waitFor(() => expect(result.current.logs.map((l) => l.id)).toEqual(['a3', 'a2']));
    expect(result.current.page).toBe(0);
    expect(result.current.hasMore).toBe(true);
  });

  it('steps back to the last non-empty page when a deletion empties the current one', async () => {
    const repo = installRepo();
    const p = await repo.profiles.ensureActive('Me');
    for (const day of [1, 2, 3]) await finish(repo, `w${day}`, p.id, day);

    const { result } = renderHook(() => useHistory(2));
    await waitFor(() => expect(result.current.total).toBe(3));
    act(() => result.current.nextPage());
    await waitFor(() => expect(result.current.logs.map((l) => l.id)).toEqual(['w1']));
    await act(() => repo.logs.softDelete(p.id, 'w1'));
    // 2 live logs, page size 2 → last page is 0
    await waitFor(() => expect(result.current.logs.map((l) => l.id)).toEqual(['w3', 'w2']));
    expect(result.current.page).toBe(0);
    expect(result.current.total).toBe(2);
    expect(result.current.hasMore).toBe(false);
  });

  it('drops the previously loaded logs when a live re-run fails', async () => {
    const repo = installRepo();
    const p = await repo.profiles.ensureActive('Me');
    await finish(repo, 'w1', p.id, 1);

    const { result } = renderHook(() => useHistory());
    await waitFor(() => expect(result.current.logs.map((l) => l.id)).toEqual(['w1']));
    vi.spyOn(repo.logs, 'count').mockRejectedValue(new Error('broken'));
    await act(() => finish(repo, 'w2', p.id, 2));
    await waitFor(() => expect(result.current.error).toBeInstanceOf(Error));
    expect(result.current.logs).toEqual([]);
    expect(result.current.total).toBe(0);
    expect(result.current.isLoading).toBe(false);
  });
});
