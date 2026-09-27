import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { Exercise, WorkoutDraft } from '@/contracts/domain';
import type { Repository } from '@/contracts/repo';
import { createRepository, TytaxDatabase } from '@/lib/db';

const holder = vi.hoisted(() => ({ repo: undefined as unknown }));

vi.mock('@/lib/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/db')>();
  return { ...actual, getRepository: () => holder.repo };
});

const base = { muscleGroup: 'CHEST', pattern: 'push', isUnilateral: false, defaultSets: 3 } as const;
const smith: Exercise = { ...base, id: 'smith', name: 'Smith Press', modality: 'tytax', impact: [], defaultReps: '8', stationId: 'SMITH' };
const curl: Exercise = { ...base, id: 'curl', name: 'Leg Curl', modality: 'tytax', impact: [], defaultReps: '10', stationId: 'LEG_CURL' };
// G1 tags time exercises (`measure: 'time'`); the defaultReps heuristic is gone, so the fixture carries the tag.
const plank: Exercise = { ...base, id: 'plank', name: 'Plank', modality: 'bodyweight', impact: [], defaultReps: '30-60s', measure: 'time' };
const byId = new Map([smith, curl, plank].map((e) => [e.id, e]));

vi.mock('@/lib/catalog', () => ({
  loadCatalog: async () => ({
    chunks: ['tytax'], exercises: [...byId.values()], getById: (id: string) => byId.get(id),
    getByLegacyName: () => undefined, stations: [], attachments: [],
  }),
}));

const { useWorkout } = await import('../use-workout');
const { useWorkoutStore } = await import('@/stores/workout-store');

let n = 0;
let repo: Repository;

describe('useWorkout — Wave 2', () => {
  beforeEach(() => {
    n += 1;
    repo = createRepository({ db: new TytaxDatabase(`use-workout-w2-${n}`) });
    holder.repo = repo;
    useWorkoutStore.getState().discard();
    localStorage.clear();
  });

  it.each([
    ['without', false],
    ['with', true],
  ] as const)('without a profile every Wave 2 action is a no-op (repo %s the setup writer pair)', async (_label, hasWriter) => {
    const setSetup = vi.fn(async () => undefined);
    const getSetup = vi.fn(async () => ({ seat: '9' }));
    // Explicit fakes: the result must not depend on what the real notes repo offers.
    const notes = Object.assign(
      Object.create(repo.notes) as object,
      hasWriter ? { setSetup, getSetup } : { setSetup: undefined, getSetup: undefined },
    );
    holder.repo = { ...repo, notes };
    const { result } = renderHook(() => useWorkout());
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.profileId).toBeUndefined();
    expect(await result.current.orderByStation()).toBe(false);
    const log = { id: 'l', profileId: 'x', sessionName: 'S', exercises: [] } as unknown as Parameters<typeof result.current.repeatLog>[0];
    expect(result.current.repeatLog(log)).toBeNull();
    expect(await result.current.setup.load('smith')).toBeUndefined();
    expect(await result.current.setup.save('smith', { seat: '1' })).toEqual({ saved: false, reason: 'unsupported' });
    // canSave tells what the repository can store; without a profile nothing is read or written.
    expect(result.current.setup.canSave).toBe(hasWriter);
    expect(setSetup).not.toHaveBeenCalled();
    expect(getSetup).not.toHaveBeenCalled();
  });

  it('orders by station, repeats a log and tells the measure', async () => {
    const p = await repo.profiles.ensureActive('Me');
    const { result } = renderHook(() => useWorkout());
    await waitFor(() => expect(result.current.profileId).toBe(p.id));
    // No draft: the catalog is not loaded, so an unknown measure is 'reps'.
    expect(result.current.measureOfExercise('plank')).toBe('reps');

    const draft: WorkoutDraft = {
      id: 'd1', profileId: p.id, sessionName: 'Mixed', startedAt: '2026-09-20T10:00:00.000Z',
      exercises: [
        { uid: 'a', exerciseId: 'curl', exerciseName: 'Leg Curl', modality: 'tytax', sets: [{ id: 's1', type: 'working', kg: 40, reps: 10, done: true }] },
        { uid: 'b', exerciseId: 'custom-hold', exerciseName: 'Hold', modality: 'custom', sets: [{ id: 's2', type: 'working', kg: 0, reps: 0, done: false, durationSeconds: 20 }] },
        { uid: 'c', exerciseId: 'smith', exerciseName: 'Smith Press', modality: 'tytax', sets: [{ id: 's3', type: 'working', kg: 60, reps: 8, done: true }] },
      ],
    };
    act(() => {
      useWorkoutStore.getState().startDraft(draft);
    });
    // Catalog loads once a draft exists.
    await waitFor(() => expect(result.current.measureOfExercise('plank')).toBe('time'));
    expect(result.current.measureOfExercise('smith')).toBe('reps');
    // Unknown to the catalog: its draft sets carry seconds.
    expect(result.current.measureOfExercise('custom-hold')).toBe('time');
    expect(result.current.measureOfExercise('nothing')).toBe('reps');

    expect(await act(() => result.current.orderByStation())).toBe(true);
    // SMITH c → LEG_CURL a → no station b.
    expect(result.current.draft?.exercises.map((e) => e.uid)).toEqual(['c', 'a', 'b']);

    const { log } = await repo.finishWorkout(useWorkoutStore.getState().draft as WorkoutDraft, { finishedAt: '2026-09-20T11:00:00.000Z' });
    // The draft still exists: refused until replace.
    expect(result.current.repeatLog(log)).toBeNull();
    let repeated: WorkoutDraft | null = null;
    act(() => {
      repeated = result.current.repeatLog(log, { replace: true });
    });
    expect(repeated).not.toBeNull();
    expect(result.current.draft?.sessionName).toBe('Mixed');
    expect(result.current.draft?.id).not.toBe('d1');
    expect(result.current.draft?.exercises.map((e) => e.exerciseId)).toEqual(['smith', 'curl', 'custom-hold']);
  });

  it('setup load/save go through the adapter for the active profile', async () => {
    const p = await repo.profiles.ensureActive('Me');
    const saved = new Map<string, unknown>();
    const notes = Object.assign(Object.create(repo.notes) as object, {
      setSetup: async (profileId: string, exerciseId: string, setup: unknown) => {
        saved.set(`${profileId}/${exerciseId}`, setup);
      },
      // G2's NotesRepoExt pair (g2/src/lib/db/repo/notes.ts): the adapter requires both.
      getSetup: async () => undefined,
    });
    holder.repo = { ...repo, notes };
    const { result } = renderHook(() => useWorkout());
    await waitFor(() => expect(result.current.profileId).toBe(p.id));
    expect(result.current.setup.canSave).toBe(true);
    expect(await result.current.setup.save('smith', { pin: ' 4 ' })).toEqual({ saved: true, setup: { pin: '4' } });
    expect(saved.get(`${p.id}/smith`)).toEqual({ pin: '4' });
    expect(await result.current.setup.load('smith')).toBeUndefined();
  });
});
