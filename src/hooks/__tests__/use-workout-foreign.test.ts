import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { Exercise, PRRecord } from '@/contracts/domain';
import type { Repository } from '@/contracts/repo';
import { createRepository, TytaxDatabase } from '@/lib/db';

const holder = vi.hoisted(() => ({ repo: undefined as unknown }));
vi.mock('@/lib/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/db')>();
  return { ...actual, getRepository: () => holder.repo };
});

const bench: Exercise = {
  id: 'bench', name: 'Bench', modality: 'tytax', muscleGroup: 'CHEST', pattern: 'push', isUnilateral: false,
  defaultSets: 3, defaultReps: '8', impact: [{ muscle: 'Chest', score: 100 }],
};
vi.mock('@/lib/catalog', () => ({
  loadCatalog: async () => ({
    chunks: ['tytax'], exercises: [bench], getById: (id: string) => (id === 'bench' ? bench : undefined),
    getByLegacyName: () => undefined, stations: [], attachments: [],
  }),
}));

const { useWorkout } = await import('../use-workout');
const { livePRCheck } = await import('../use-pr');
const { E1RM_MAX_REPS } = await import('@/lib/training');
const { useWorkoutStore } = await import('@/stores/workout-store');
const { ForeignDraftError } = await import('@/stores/workout-orchestrator');

let n = 0;
let repo: Repository;

describe('useWorkout: foreign draft after a profile switch (R04)', () => {
  beforeEach(() => {
    n += 1;
    repo = createRepository({ db: new TytaxDatabase(`use-workout-foreign-${n}`) });
    holder.repo = repo;
    useWorkoutStore.getState().discard();
    localStorage.clear();
  });

  it('flags the draft, names its owner, refuses add/finish and switches back', async () => {
    const a = await repo.profiles.ensureActive('Ana');
    const b = await repo.profiles.create({ name: 'Bo' });
    const { result } = renderHook(() => useWorkout());
    await waitFor(() => expect(result.current.profileId).toBe(a.id));
    act(() => void result.current.startQuick('Q'));
    expect(result.current.foreignDraft).toBe(false);

    await act(async () => repo.profiles.setActive(b.id));
    await waitFor(() => expect(result.current.profileId).toBe(b.id));
    expect(result.current.foreignDraft).toBe(true);
    await waitFor(() => expect(result.current.draftOwner?.name).toBe('Ana'));
    expect(await result.current.addExercise(bench)).toBeNull();
    await expect(result.current.finish()).rejects.toBeInstanceOf(ForeignDraftError);
    expect(await repo.logs.list(a.id)).toHaveLength(0);
    expect(await repo.logs.list(b.id)).toHaveLength(0);

    await act(async () => result.current.switchToDraftOwner());
    await waitFor(() => expect(result.current.profileId).toBe(a.id));
    expect(result.current.foreignDraft).toBe(false);
    expect(result.current.draftOwner).toBeUndefined();
  });

  it('reports a deleted owner as null (discard only)', async () => {
    const a = await repo.profiles.ensureActive('Ana');
    const b = await repo.profiles.create({ name: 'Bo' });
    const { result } = renderHook(() => useWorkout());
    await waitFor(() => expect(result.current.profileId).toBe(a.id));
    act(() => void result.current.startQuick('Q'));
    await act(async () => {
      await repo.profiles.setActive(b.id);
      await repo.profiles.remove(a.id);
    });
    await waitFor(() => expect(result.current.draftOwner).toBeNull());
    expect(result.current.foreignDraft).toBe(true);
    expect(useWorkoutStore.getState().draft?.profileId).toBe(a.id);
  });
});

describe('livePRCheck mirrors detectPRs (item 12)', () => {
  const rec = (prType: PRRecord['prType'], value: number) => ({ prType, value }) as PRRecord;

  it('e1RM PRs only up to 12 reps; weight PRs at any reps', () => {
    // The local LIVE_E1RM_PR_MAX_REPS copy is gone: the cap is G1's E1RM_MAX_REPS, asserted
    // at the boundary below (12 reps ranks, 13 does not).
    expect(E1RM_MAX_REPS).toBe(12);
    const best = { e1rm: rec('e1rm', 100), weight: rec('weight', 100) };
    expect(livePRCheck(best, 90, 8)).toEqual({ isPR: true, prType: 'e1rm' });
    expect(livePRCheck({ e1rm: rec('e1rm', 50) }, 16, 35)).toEqual({ isPR: false, prType: null });
    expect(livePRCheck(best, 105, 20)).toEqual({ isPR: true, prType: 'weight' });
    // 80 × 12 → e1RM 80·36/25 = 115.2 > 100; 80 × 13 → unrankable, and 80 < weight best 100.
    expect(livePRCheck(best, 80, E1RM_MAX_REPS)).toEqual({ isPR: true, prType: 'e1rm' });
    expect(livePRCheck(best, 80, E1RM_MAX_REPS + 1)).toEqual({ isPR: false, prType: null });
  });

  it('a time set is never a PR candidate (detectPRs skips isTimeSet)', () => {
    const best = { e1rm: rec('e1rm', 10), weight: rec('weight', 10), reps: rec('reps', 1) };
    expect(livePRCheck(best, 50, 5, 30)).toEqual({ isPR: false, prType: null });
    expect(livePRCheck(best, 0, 20, 45)).toEqual({ isPR: false, prType: null });
    // durationSeconds 0 / undefined is a reps set.
    expect(livePRCheck(best, 50, 5, 0)).toEqual({ isPR: true, prType: 'e1rm' });
  });

  it('reps PRs for 0 kg sets; nothing without a stored best (baseline)', () => {
    expect(livePRCheck({ reps: rec('reps', 12) }, 0, 13)).toEqual({ isPR: true, prType: 'reps' });
    expect(livePRCheck({ reps: rec('reps', 12) }, 0, 12)).toEqual({ isPR: false, prType: null });
    expect(livePRCheck({}, 100, 5)).toEqual({ isPR: false, prType: null });
    expect(livePRCheck({ weight: rec('weight', 50) }, 60, 0)).toEqual({ isPR: false, prType: null });
  });
});
