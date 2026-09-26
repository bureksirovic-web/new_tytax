import { it, expect, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import type { WorkoutDraft } from '@/contracts/domain';

const router = { push: vi.fn(), replace: vi.fn(), back: vi.fn() };
vi.mock('next/navigation', () => ({ useRouter: () => router }));
// Cold load: the active-profile query never resolves (watch never emits).
vi.mock('@/lib/db', () => ({ getRepository: () => ({ watch: () => () => undefined }) }));
vi.mock('@/lib/catalog', () => ({ catalog: { search: async () => [] }, loadCatalog: () => new Promise(() => undefined) }));

import { useWorkoutStore } from '@/stores/workout-store';
import ActiveWorkoutPage from '@/app/(app)/workout/active/page-client';

const FOREIGN: WorkoutDraft = {
  id: 'd', profileId: 'p1', sessionName: 'Other', startedAt: '2026-09-26T10:00:00.000Z',
  exercises: [{ uid: 'u1', exerciseId: 'bench', exerciseName: 'Bench', modality: 'tytax', sets: [{ id: 's1', type: 'working', kg: 100, reps: 5, done: false }] }],
};

it('keeps the draft out of reach until the active profile is known', async () => {
  useWorkoutStore.setState({ draft: FOREIGN });
  render(<ActiveWorkoutPage />);
  await act(async () => {});
  expect(screen.getByTestId('active-workout-loading')).toBeInTheDocument();
  expect(screen.queryAllByTestId('session-exercise')).toHaveLength(0);
  expect(screen.queryByTestId('active-workout')).toBeNull();
  expect(router.replace).not.toHaveBeenCalled();
});
