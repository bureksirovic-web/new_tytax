import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import type { Exercise, WorkoutDraft } from '@/contracts/domain';

const router = { push: vi.fn(), replace: vi.fn(), back: vi.fn() };
vi.mock('next/navigation', () => ({ useRouter: () => router }));
vi.mock('@/lib/db', () => ({ getRepository: () => ({ watch: () => () => undefined }) }));
vi.mock('@/lib/catalog', () => ({ catalog: { search: async () => [] }, loadCatalog: () => new Promise(() => undefined) }));

import { useWorkoutStore } from '@/stores/workout-store';
import { useRestTimerStore } from '@/stores/rest-timer-store';
import ActiveWorkoutPage, { addPicked } from '@/app/(app)/workout/active/page-client';
import { elapsedSeconds, formatElapsed } from '@/app/(app)/workout/active/workout-elapsed';

const T0 = Date.UTC(2026, 8, 26, 10, 0, 0);

const DRAFT: WorkoutDraft = {
  id: 'draft-1',
  profileId: 'p1',
  sessionName: 'Upper A',
  startedAt: new Date(T0 - 125_000).toISOString(),
  exercises: [],
};

const EXERCISE = {
  id: 'tytax_smith-machine_smith-flat-bench-press',
  name: 'Smith Flat Bench Press',
  modality: 'tytax',
  defaultSets: 3,
  impact: [],
} as unknown as Exercise;

async function flush() {
  await act(async () => {});
}

describe('active workout page shell', () => {
  const request = vi.fn(async () => ({ released: false, release: vi.fn(async () => undefined) }));

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(T0);
    localStorage.clear();
    router.replace.mockReset();
    useRestTimerStore.setState({ timer: null });
    useWorkoutStore.setState({ draft: DRAFT });
    request.mockClear();
    Object.defineProperty(navigator, 'wakeLock', { value: { request }, configurable: true });
  });
  afterEach(() => {
    vi.useRealTimers();
    Reflect.deleteProperty(navigator, 'wakeLock');
  });

  it('shows elapsed workout time from draft.startedAt and ticks', async () => {
    render(<ActiveWorkoutPage />);
    await flush();
    // Started 125 s ago → "2:05".
    expect(screen.getByTestId('workout-elapsed')).toHaveTextContent('2:05');
    act(() => {
      vi.advanceTimersByTime(5_000);
    });
    expect(screen.getByTestId('workout-elapsed')).toHaveTextContent('2:10');
  });

  it('requests a screen wake lock while mounted', async () => {
    render(<ActiveWorkoutPage />);
    await flush();
    expect(request).toHaveBeenCalledWith('screen');
  });

  it('renders the rest timer bar when a rest is running', async () => {
    render(<ActiveWorkoutPage />);
    await flush();
    expect(screen.queryByTestId('rest-timer')).toBeNull();
    act(() => useRestTimerStore.getState().start(90, Date.now()));
    expect(screen.getByTestId('rest-timer-remaining')).toHaveTextContent('1:30');
    expect(screen.getByTestId('active-workout')).toBeInTheDocument();
  });
});

describe('addPicked', () => {
  beforeEach(() => {
    useWorkoutStore.setState({ draft: { ...DRAFT, exercises: [] } });
  });

  it('uses the prefilled add when it succeeds', async () => {
    const prefilled = vi.fn(async () => 'uid-1');
    expect(await addPicked(EXERCISE, prefilled)).toBe('uid-1');
    expect(prefilled).toHaveBeenCalledWith(EXERCISE);
    expect(useWorkoutStore.getState().draft?.exercises).toHaveLength(0);
  });

  it('falls back to the store when there is no profile yet (null)', async () => {
    const uid = await addPicked(EXERCISE, async () => null);
    expect(uid).toEqual(expect.any(String));
    const exercises = useWorkoutStore.getState().draft?.exercises ?? [];
    expect(exercises.map((e) => e.exerciseId)).toEqual([EXERCISE.id]);
  });

  it('falls back to the store when the prefill throws', async () => {
    const uid = await addPicked(EXERCISE, async () => {
      throw new Error('db down');
    });
    expect(uid).toEqual(expect.any(String));
    expect(useWorkoutStore.getState().draft?.exercises).toHaveLength(1);
  });

  it('adds nothing without a draft', async () => {
    useWorkoutStore.setState({ draft: null });
    expect(await addPicked(EXERCISE, async () => null)).toBeNull();
  });
});

describe('elapsed helpers', () => {
  it('computes whole seconds and formats m:ss / h:mm:ss', () => {
    expect(elapsedSeconds('2026-09-26T10:00:00.000Z', Date.UTC(2026, 8, 26, 10, 1, 5))).toBe(65);
    expect(elapsedSeconds('not a date', T0)).toBe(0);
    expect(elapsedSeconds(new Date(T0 + 5000).toISOString(), T0)).toBe(0);
    expect(formatElapsed(65)).toBe('1:05');
    // 3600 + 2*60 + 3 = 3723 s.
    expect(formatElapsed(3723)).toBe('1:02:03');
  });
});
