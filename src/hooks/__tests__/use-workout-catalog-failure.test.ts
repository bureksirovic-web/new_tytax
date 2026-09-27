/**
 * Refuter R2 (2026-09-27): when the lazy catalog failed to load, a hold with
 * no duration or ghost on its sets was measured (painted and logged) as a
 * reps set, and the failed load was never retried. Now a failed load retries
 * on `online` / visibility, and until then the device's cached time ids
 * (stores/measure-cache) keep a known hold a hold.
 */
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { Exercise } from '@/contracts/domain';
import type { Repository } from '@/contracts/repo';
import { createRepository, TytaxDatabase } from '@/lib/db';

const holder = vi.hoisted(() => ({ repo: undefined as unknown, fail: false, calls: 0 }));

vi.mock('@/lib/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/db')>();
  return { ...actual, getRepository: () => holder.repo };
});

const plank: Exercise = {
  id: 'plank', name: 'Plank', modality: 'bodyweight', muscleGroup: 'CORE', pattern: 'hold', isUnilateral: false,
  defaultSets: 1, defaultReps: '60s', measure: 'time', impact: [{ muscle: 'Core', score: 100 }],
};

vi.mock('@/lib/catalog', () => ({
  loadCatalog: async () => {
    holder.calls += 1;
    if (holder.fail) throw new Error('chunk 404');
    return { chunks: ['bodyweight'], exercises: [plank], getById: (id: string) => (id === 'plank' ? plank : undefined), getByLegacyName: () => undefined, stations: [], attachments: [] };
  },
}));

const { useWorkout } = await import('../use-workout');
const { useWorkoutStore } = await import('@/stores/workout-store');
const { TIME_IDS_STORAGE_KEY, resetMeasureCacheForTests } = await import('@/stores/measure-cache');

let n = 0;
let repo: Repository;
let profileId: string;

beforeEach(async () => {
  n += 1;
  repo = createRepository({ db: new TytaxDatabase(`catalog-failure-${n}`) });
  holder.repo = repo;
  holder.fail = false;
  holder.calls = 0;
  localStorage.clear();
  resetMeasureCacheForTests();
  useWorkoutStore.getState().discard();
  profileId = (await repo.profiles.ensureActive('Me')).id;
});
afterEach(() => useWorkoutStore.getState().discard());

/** A quick workout with one plank set that carries no duration and no ghost (no history). */
function ghostlessHold() {
  const store = useWorkoutStore.getState();
  store.startQuick(profileId, 'Quick');
  store.addPreparedExercise({
    uid: 'u1', exerciseId: 'plank', exerciseName: 'Plank', modality: 'bodyweight',
    sets: [{ id: 's1', type: 'working', kg: 0, reps: 0, done: false }],
  });
}

describe('measure of a hold when the catalog cannot load', () => {
  it('is still time after a reload when a catalog seen on this device tagged it', async () => {
    // Session 1: the catalog loads and its time ids are remembered.
    const first = renderHook(() => useWorkout());
    await waitFor(() => expect(first.result.current.ready).toBe(true));
    act(() => ghostlessHold());
    await waitFor(() => expect(holder.calls).toBeGreaterThan(0));
    await waitFor(() => expect(localStorage.getItem(TIME_IDS_STORAGE_KEY)).toBe('["plank"]'));
    first.unmount();

    // Session 2 (reload): memory gone, catalog chunk fails.
    resetMeasureCacheForTests();
    holder.fail = true;
    const { result } = renderHook(() => useWorkout());
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.draft?.exercises[0].sets[0].durationSeconds).toBeUndefined();
    expect(result.current.measureOfExercise('plank')).toBe('time');
    expect(result.current.measureOfExercise('bench')).toBe('reps');
  });

  it('retries a failed load when the device comes back online', async () => {
    holder.fail = true;
    const { result } = renderHook(() => useWorkout());
    await waitFor(() => expect(result.current.ready).toBe(true));
    act(() => ghostlessHold());
    await waitFor(() => expect(holder.calls).toBe(1));
    expect(result.current.measureOfExercise('plank')).toBe('reps');

    holder.fail = false;
    await act(async () => {
      window.dispatchEvent(new Event('online'));
    });
    await waitFor(() => expect(result.current.measureOfExercise('plank')).toBe('time'));
    expect(holder.calls).toBe(2);
  });
});
