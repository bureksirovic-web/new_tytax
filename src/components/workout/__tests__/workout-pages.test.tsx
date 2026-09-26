import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import type { WorkoutDebrief, WorkoutDraft } from '@/contracts/domain';

const router = { push: vi.fn(), replace: vi.fn(), back: vi.fn() };
vi.mock('next/navigation', () => ({ useRouter: () => router }));

const finishWorkout = vi.fn<(d: WorkoutDraft, debrief?: WorkoutDebrief) => Promise<unknown>>();
// watch: useWorkout() (active page) subscribes to live queries; never emitting keeps the profile loading.
vi.mock('@/lib/db', () => ({ getRepository: () => ({ finishWorkout, watch: () => () => undefined }) }));
// loadCatalog: the exercise card resolves catalog entries via useExercises(); never resolving keeps it loading.
vi.mock('@/lib/catalog', () => ({ catalog: { search: async () => [] }, loadCatalog: () => new Promise(() => undefined) }));

import { WORKOUT_DRAFT_STORAGE_KEY, useWorkoutStore } from '@/stores/workout-store';
import ActiveWorkoutPage from '@/app/(app)/workout/active/page-client';
import DebriefPage from '@/app/(app)/workout/debrief/page-client';

const DRAFT: WorkoutDraft = {
  id: 'draft-1',
  profileId: 'p1',
  sessionName: 'Upper A',
  startedAt: '2026-09-26T10:00:00.000Z',
  exercises: [
    {
      uid: 'u1',
      exerciseId: 'bench',
      exerciseName: 'Bench',
      modality: 'tytax',
      sets: [
        { id: 's1', type: 'working', kg: 100, reps: 5, done: true },
        { id: 's2', type: 'working', kg: 100, reps: 5, done: false },
      ],
    },
  ],
};

/** Puts a draft in storage only, as a reload would find it. */
function persistDraft(draft: WorkoutDraft | null) {
  localStorage.setItem(WORKOUT_DRAFT_STORAGE_KEY, JSON.stringify({ state: { draft }, version: 3 }));
}

async function flush() {
  await act(async () => {});
}

describe('active workout page', () => {
  beforeEach(() => {
    router.replace.mockReset();
    router.push.mockReset();
    localStorage.clear();
  });

  it('restores a persisted draft after reload and does not redirect', async () => {
    persistDraft(DRAFT);
    useWorkoutStore.setState({ draft: null });
    persistDraft(DRAFT);
    render(<ActiveWorkoutPage />);
    await flush();
    expect(screen.getByTestId('active-workout')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Upper A');
    expect(screen.getAllByTestId('set-row')).toHaveLength(2);
    expect(router.replace).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('finish-workout'));
    expect(router.push).toHaveBeenCalledWith('/workout/debrief');
  });

  it('redirects to /workout once hydrated without a draft', async () => {
    useWorkoutStore.setState({ draft: null });
    render(<ActiveWorkoutPage />);
    await flush();
    expect(screen.queryByTestId('active-workout')).toBeNull();
    expect(router.replace).toHaveBeenCalledWith('/workout');
    expect(router.replace).toHaveBeenCalledTimes(1);
  });
});

describe('debrief page', () => {
  beforeEach(() => {
    router.replace.mockReset();
    finishWorkout.mockReset();
    localStorage.clear();
    useWorkoutStore.setState({ draft: DRAFT });
  });

  it('saves with rpe and notes, discards the draft and goes to history only', async () => {
    finishWorkout.mockResolvedValue({});
    render(<DebriefPage />);
    await flush();
    // 1 done set of 100 kg × 5 → volume 500, done sets 1.
    expect(screen.getByTestId('debrief-volume')).toHaveTextContent('500');
    expect(screen.getByTestId('debrief-sets')).toHaveTextContent('1');

    fireEvent.change(screen.getByTestId('debrief-rpe'), { target: { value: '8' } });
    fireEvent.change(screen.getByTestId('debrief-notes'), { target: { value: '  solid  ' } });
    await act(async () => {
      fireEvent.click(screen.getByTestId('save-workout'));
    });

    expect(finishWorkout).toHaveBeenCalledWith(DRAFT, { rpe: 8, notes: 'solid' });
    expect(useWorkoutStore.getState().draft).toBeNull();
    expect(router.replace).toHaveBeenCalledWith('/history');
    expect(router.replace).not.toHaveBeenCalledWith('/workout');
  });

  it('keeps the draft and shows an error when saving fails', async () => {
    finishWorkout.mockRejectedValue(new Error('disk full'));
    render(<DebriefPage />);
    await flush();
    await act(async () => {
      fireEvent.click(screen.getByTestId('save-workout'));
    });
    expect(screen.getByTestId('debrief-error')).toBeInTheDocument();
    expect(useWorkoutStore.getState().draft).toEqual(DRAFT);
    expect(screen.getByTestId('save-workout')).not.toBeDisabled();
    expect(router.replace).not.toHaveBeenCalled();
  });
});
