import 'fake-indexeddb/auto';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { WorkoutDraft } from '@/contracts/domain';
import type { Repository } from '@/contracts/repo';
import { createRepository, TytaxDatabase } from '@/lib/db';

const holder = vi.hoisted(() => ({ repo: undefined as unknown, push: vi.fn() }));

vi.mock('@/lib/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/db')>();
  return { ...actual, getRepository: () => holder.repo };
});
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: holder.push }) }));

const { default: DashboardPage } = await import('@/app/(app)/dashboard/page-client');
const { useWorkoutStore } = await import('@/stores/workout-store');
const { ALL_PRESETS } = await import('@/lib/programs/presets');

let n = 0;
function installRepo(): Repository {
  n += 1;
  const repo = createRepository({ db: new TytaxDatabase(`dashboard-${n}`) });
  holder.repo = repo;
  holder.push.mockClear();
  useWorkoutStore.setState({ draft: null });
  return repo;
}

function draft(profileId: string, id: string, startedAt: Date, sessionName: string): WorkoutDraft {
  return {
    id,
    profileId,
    sessionName,
    startedAt: startedAt.toISOString(),
    exercises: [
      {
        uid: `u-${id}`,
        exerciseId: 'bench',
        exerciseName: 'Bench',
        modality: 'tytax',
        sets: [{ id: `s-${id}`, type: 'working', kg: 100, reps: 5, done: true }],
      },
    ],
  };
}

describe('DashboardPage', () => {
  it('shows the newest workout and the active program from the repository', async () => {
    const repo = installRepo();
    const me = await repo.profiles.ensureActive('Me');
    const now = Date.now();
    await repo.finishWorkout(draft(me.id, 'old', new Date(now - 3 * 86_400_000), 'Older Session'));
    await repo.finishWorkout(draft(me.id, 'new', new Date(now - 3_600_000), 'Newest Session'));
    await repo.programs.create(me.id, { ...ALL_PRESETS[0], name: 'Dash Program' }, { activate: true });

    render(<DashboardPage />);

    expect(await screen.findByText('Newest Session')).toBeInTheDocument();
    expect(screen.queryByText('Older Session')).toBeNull();
    expect(await screen.findByText('Dash Program')).toBeInTheDocument();
    // Both workouts fall inside the last 7 days → 2 sessions this week.
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('starts a quick workout for the active profile', async () => {
    const repo = installRepo();
    const me = await repo.profiles.ensureActive('Me');
    render(<DashboardPage />);

    const start = await screen.findByRole('button', { name: 'workout_start' });
    await waitFor(() => expect(start).toBeEnabled());
    fireEvent.click(start);

    expect(useWorkoutStore.getState().draft?.profileId).toBe(me.id);
    expect(holder.push).toHaveBeenCalledWith('/workout/active');
    expect(await screen.findByText('dashboard_no_workouts')).toBeInTheDocument();
  });

  it('resumes an in-progress workout instead of replacing it', async () => {
    const repo = installRepo();
    const me = await repo.profiles.ensureActive('Me');
    const existing = useWorkoutStore.getState().startQuick(me.id, 'Keep Me');
    render(<DashboardPage />);

    const resume = await screen.findByRole('button', { name: 'workout_session_active' });
    await waitFor(() => expect(resume).toBeEnabled());
    fireEvent.click(resume);

    expect(useWorkoutStore.getState().draft?.id).toBe(existing.id);
    expect(holder.push).toHaveBeenCalledWith('/workout/active');
    expect(holder.push).toHaveBeenCalledTimes(1);
  });
});
