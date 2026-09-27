import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import type { WorkoutDebrief, WorkoutDraft } from '@/contracts/domain';
import { DEFAULT_PROFILE_SETTINGS } from '@/contracts/domain';
import type { FinishResult } from '@/contracts/repo';

// Critic round 2: a failing progression-readiness check (e.g. a catalog chunk
// that cannot load offline) must never block saving the workout.
const router = { push: vi.fn(), replace: vi.fn(), back: vi.fn() };
vi.mock('next/navigation', () => ({ useRouter: () => router }));

const finish = vi.fn<(d?: WorkoutDebrief) => Promise<FinishResult>>();
vi.mock('@/hooks/use-workout', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/hooks/use-workout')>();
  return {
    ...actual,
    useWorkout: () => ({
      ready: true, foreignDraft: false, finish, settings: DEFAULT_PROFILE_SETTINGS,
      profileId: 'p1', profile: { id: 'p1', birthYear: new Date().getFullYear() - 11 },
    }),
  };
});
vi.mock('@/hooks/use-repo', () => ({ useRepo: () => ({}) }));

const computeProgressionCandidate = vi.fn();
vi.mock('@/components/workout/progression-candidate', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/components/workout/progression-candidate')>();
  return { ...actual, computeProgressionCandidate: (...args: unknown[]) => computeProgressionCandidate(...args) };
});

import { useWorkoutStore } from '@/stores/workout-store';
import DebriefPage from '@/app/(app)/workout/debrief/page-client';

const DRAFT: WorkoutDraft = {
  id: 'draft-offline', profileId: 'p1', sessionName: 'Calisthenics B', programSessionId: 's-b',
  startedAt: new Date(Date.now() - 30 * 60_000).toISOString(),
  exercises: [{ uid: 'u1', exerciseId: 'bw_dip_negative-dip', exerciseName: 'Negative Dip', modality: 'bodyweight',
    sets: [{ id: 'a', type: 'working', kg: 0, reps: 8, done: true }] }],
};

describe('debrief page: progression check failure', () => {
  beforeEach(() => {
    router.replace.mockReset();
    finish.mockReset();
    computeProgressionCandidate.mockReset();
    localStorage.clear();
    useWorkoutStore.setState({ draft: DRAFT });
  });

  it('still finishes, discards the draft and goes to history when readiness rejects', async () => {
    computeProgressionCandidate.mockRejectedValue(new Error('catalog chunk failed to load (offline)'));
    finish.mockResolvedValue({ log: {} as FinishResult['log'], prs: [], alreadyFinished: false });
    render(<DebriefPage />);
    await act(async () => {
      fireEvent.click(screen.getByTestId('save-workout'));
    });
    expect(computeProgressionCandidate).toHaveBeenCalledTimes(1);
    expect(finish).toHaveBeenCalledTimes(1);
    expect(useWorkoutStore.getState().draft).toBeNull();
    expect(router.replace).toHaveBeenCalledWith('/history');
    expect(screen.queryByTestId('progression-card')).toBeNull();
  });
});
