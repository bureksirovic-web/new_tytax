import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { Exercise, ProgramTemplate } from '@/contracts/domain';
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

const { useWorkout, nextSessionOf } = await import('../use-workout');
const { useWorkoutStore } = await import('@/stores/workout-store');

const template: ProgramTemplate = {
  name: 'P', splitType: 'custom', frequency: 2, periodizationType: 'none', sessionOrder: [],
  sessions: [
    { id: 'a', programId: '', name: 'Push', dayIndex: 0, exercises: [{ exerciseId: 'bench', exerciseName: 'Bench', modality: 'tytax', sets: 2, reps: '8' }] },
    { id: 'r', programId: '', name: 'Rest', dayIndex: 1, exercises: [], isRest: true },
  ],
  modalitiesUsed: ['tytax'], isPreset: false, currentSessionIndex: 0,
};

let n = 0;
let repo: Repository;

describe('useWorkout', () => {
  beforeEach(() => {
    n += 1;
    repo = createRepository({ db: new TytaxDatabase(`use-workout-${n}`) });
    holder.repo = repo;
    useWorkoutStore.getState().discard();
    localStorage.clear();
  });

  it('is not ready without a profile and every action is a no-op', async () => {
    const { result } = renderHook(() => useWorkout());
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.profileId).toBeUndefined();
    expect(result.current.startQuick('Q')).toBeNull();
    expect(await result.current.prepareProgramStart()).toBeNull();
    expect(await result.current.startProgram({ deload: false, weakPoint: false })).toBeNull();
    expect(await result.current.addExercise(bench)).toBeNull();
    expect(await result.current.swapExercise('u', bench)).toBeNull();
    expect(await result.current.skipRestDay()).toBeNull();
    expect(result.current.settings.restSeconds).toBe(90);
  });

  it('exposes the next session and runs the program start + finish flow', async () => {
    const p = await repo.profiles.ensureActive('Me');
    await repo.programs.create(p.id, template, { activate: true });
    const { result } = renderHook(() => useWorkout());
    await waitFor(() => expect(result.current.nextSession?.session.name).toBe('Push'));
    expect(result.current.ready).toBe(true);
    expect(result.current.nextSession?.isRest).toBe(false);

    const prep = await act(() => result.current.prepareProgramStart());
    expect(prep?.offers).toEqual({});
    await act(() => result.current.startProgram({ deload: false, weakPoint: false }));
    expect(result.current.draft?.sessionName).toBe('Push');
    expect(result.current.draft?.exercises[0].sets).toHaveLength(2);

    const uid = await act(() => result.current.addExercise(bench));
    expect(result.current.draft?.exercises).toHaveLength(2);
    expect(await act(() => result.current.swapExercise(uid ?? '', bench))).toBe(uid);

    // without a prepared plan startProgram prepares again
    await act(() => result.current.startProgram({ deload: false, weakPoint: false }));
    expect(result.current.draft?.exercises).toHaveLength(1);

    useWorkoutStore.getState().updateSet(result.current.draft!.exercises[0].uid, result.current.draft!.exercises[0].sets[0].id, { kg: 50, reps: 5, done: true });
    const res = await act(() => result.current.finish({ rpe: 7 }));
    expect(res.advancedProgram?.nextSessionIndex).toBe(1);
    await waitFor(() => expect(result.current.nextSession?.isRest).toBe(true));
    const skipped = await act(() => result.current.skipRestDay());
    expect(skipped?.currentSessionIndex).toBe(0);
    act(() => {
      result.current.startQuick('Quick');
    });
    expect(result.current.draft?.sessionName).toBe('Quick');
  });

  it('nextSessionOf handles no program and empty rotations', () => {
    expect(nextSessionOf(undefined)).toBeNull();
  });
});
