import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import type { Exercise, WorkoutDraft } from '@/contracts/domain';

const router = { push: vi.fn(), replace: vi.fn(), back: vi.fn() };
vi.mock('next/navigation', () => ({ useRouter: () => router }));

const ensureActive = vi.fn(async () => ({ id: 'fresh' }));
vi.mock('@/lib/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/db')>();
  return { ...actual, getRepository: () => ({ profiles: { ensureActive } }) };
});

const hook = vi.hoisted(() => ({ current: undefined as unknown }));
vi.mock('@/hooks/use-workout', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/hooks/use-workout')>();
  return { ...actual, useWorkout: () => hook.current };
});

import { useWorkoutStore } from '@/stores/workout-store';
import { AddToWorkoutButton } from '../add-to-workout-button';

const bench = {
  id: 'bench', name: 'Bench', modality: 'tytax', muscleGroup: 'CHEST', pattern: 'push', isUnilateral: false,
  defaultSets: 3, defaultReps: '8', impact: [],
} as Exercise;
const DRAFT: WorkoutDraft = { id: 'd', profileId: 'p1', sessionName: 'S', startedAt: '2026-09-26T10:00:00.000Z', exercises: [] };

function makeHook(over: Record<string, unknown> = {}) {
  return {
    ready: true,
    profileId: 'p1',
    startQuick: vi.fn((name: string) => useWorkoutStore.getState().startQuick('p1', name)),
    addExercise: vi.fn(async () => 'u1'),
    ...over,
  };
}

async function press() {
  await act(async () => {
    fireEvent.click(screen.getByTestId('add-to-workout'));
  });
}

describe('AddToWorkoutButton', () => {
  beforeEach(() => {
    router.push.mockReset();
    ensureActive.mockClear();
    useWorkoutStore.getState().discard();
  });

  it('creates a quick draft when none exists, adds the prefilled exercise and opens the workout', async () => {
    const h = makeHook();
    hook.current = h;
    render(<AddToWorkoutButton exercise={bench} />);
    await press();
    expect(h.startQuick).toHaveBeenCalledWith('Quick workout');
    expect(h.addExercise).toHaveBeenCalledWith(bench);
    expect(useWorkoutStore.getState().draft?.sessionName).toBe('Quick workout');
    expect(router.push).toHaveBeenCalledWith('/workout/active');
  });

  it('adds to the existing draft without starting another', async () => {
    useWorkoutStore.setState({ draft: DRAFT });
    const h = makeHook();
    hook.current = h;
    render(<AddToWorkoutButton exercise={bench} />);
    await press();
    expect(h.startQuick).not.toHaveBeenCalled();
    expect(h.addExercise).toHaveBeenCalledTimes(1);
    expect(useWorkoutStore.getState().draft?.id).toBe('d');
  });

  it('creates the default profile on a fresh device and adds through the store', async () => {
    const h = makeHook({ profileId: undefined });
    hook.current = h;
    render(<AddToWorkoutButton exercise={bench} />);
    await press();
    expect(ensureActive).toHaveBeenCalledTimes(1);
    expect(h.addExercise).not.toHaveBeenCalled();
    const draft = useWorkoutStore.getState().draft;
    expect(draft?.profileId).toBe('fresh');
    expect(draft?.exercises.map((e) => e.exerciseId)).toEqual(['bench']);
    expect(router.push).toHaveBeenCalledWith('/workout/active');
  });

  it('is disabled until the workout hook is ready', () => {
    hook.current = makeHook({ ready: false });
    render(<AddToWorkoutButton exercise={bench} />);
    expect(screen.getByTestId('add-to-workout')).toBeDisabled();
    expect(router.push).not.toHaveBeenCalled();
    expect(ensureActive).not.toHaveBeenCalled();
  });
});
