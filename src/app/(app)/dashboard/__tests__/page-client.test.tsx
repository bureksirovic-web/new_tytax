import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { BENCH, NOW, SQUAT, TEMPLATE, installRepo, seedLogs } from './dashboard-harness';

const holder = vi.hoisted(() => ({ repo: undefined as unknown, push: vi.fn() }));

vi.mock('@/lib/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/db')>();
  return { ...actual, getRepository: () => holder.repo };
});
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: holder.push }) }));
vi.mock('@/components/providers', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/components/providers')>();
  const i18n = await import('@/lib/i18n');
  type Key = Parameters<typeof i18n.t>[0];
  return { ...actual, useLocale: () => ({ locale: 'en', setLocale: () => {}, t: (k: Key) => i18n.t(k, 'en') }) };
});

const { default: DashboardPage } = await import('@/app/(app)/dashboard/page-client');
const { useWorkoutStore } = await import('@/stores/workout-store');

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  useWorkoutStore.setState({ draft: null });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const heading = () => screen.findByTestId('page-heading-dashboard');

describe('Dashboard — fresh profile', () => {
  it('shows the program CTA and the no-workouts state, and quick-starts a workout', async () => {
    const repo = installRepo(holder);
    const me = await repo.profiles.ensureActive('Me');
    render(<DashboardPage />);

    expect(await heading()).toHaveTextContent('Home');
    const noProgram = await screen.findByTestId('dash-no-program');
    expect(within(noProgram).getByRole('link', { name: 'Choose a program' })).toHaveAttribute('href', '/programs');
    expect(screen.getByText('No workouts yet')).toBeInTheDocument();
    // No stats cards without logs.
    expect(screen.queryByTestId('dash-weekly-volume')).toBeNull();
    expect(screen.queryByTestId('dash-last-workout')).toBeNull();

    const start = screen.getByTestId('dash-empty-start');
    await waitFor(() => expect(start).toBeEnabled());
    fireEvent.click(start);
    await waitFor(() => expect(holder.push).toHaveBeenCalledWith('/workout/active'));
    const draft = useWorkoutStore.getState().draft;
    expect(draft?.profileId).toBe(me.id);
    expect(draft?.programId).toBeUndefined();
    expect(draft?.sessionName).toBe('Quick workout');
  });

  it('resumes an in-progress workout instead of offering new ones', async () => {
    const repo = installRepo(holder);
    const me = await repo.profiles.ensureActive('Me');
    useWorkoutStore.getState().startQuick(me.id, 'Keep Me');
    render(<DashboardPage />);

    const resume = await screen.findByTestId('dash-resume');
    expect(resume).toHaveTextContent('Continue: Keep Me');
    expect(resume).toHaveAttribute('href', '/workout/active');
    expect(screen.queryByTestId('dash-quick-start')).toBeNull();
    expect(screen.queryByTestId('dash-empty-start')).toBeNull();
  });
});

describe('Dashboard — active program', () => {
  it("predicts today's session from the rotation pointer and starts it", async () => {
    const repo = installRepo(holder);
    const me = await repo.profiles.ensureActive('Me');
    const program = await repo.programs.create(me.id, TEMPLATE, { activate: true });
    render(<DashboardPage />);

    expect(await screen.findByTestId('dash-session-name')).toHaveTextContent('Today: Push A');
    expect(screen.getByText('2 exercises')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Dash Split' })).toHaveAttribute('href', `/programs/${program.id}`);

    const start = screen.getByTestId('dash-start-session');
    await waitFor(() => expect(start).toBeEnabled());
    fireEvent.click(start);
    await waitFor(() => expect(holder.push).toHaveBeenCalledWith('/workout/active'));
    const draft = useWorkoutStore.getState().draft;
    expect(draft?.programId).toBe(program.id);
    expect(draft?.sessionName).toBe('Push A');
    expect(draft?.exercises.map((e) => e.exerciseId)).toEqual([BENCH, SQUAT]);
  });

  it('shows a rest day and skipping it advances the rotation (live)', async () => {
    const repo = installRepo(holder);
    const me = await repo.profiles.ensureActive('Me');
    await repo.programs.create(me.id, { ...TEMPLATE, currentSessionIndex: 1 }, { activate: true });
    render(<DashboardPage />);

    expect(await screen.findByTestId('dash-session-name')).toHaveTextContent('Rest day');
    expect(screen.queryByTestId('dash-start-session')).toBeNull();
    const skip = screen.getByTestId('dash-skip-rest');
    await waitFor(() => expect(skip).toBeEnabled());
    fireEvent.click(skip);

    // Index 1 → 2: Legs B with one exercise.
    await waitFor(() => expect(screen.getByTestId('dash-session-name')).toHaveTextContent('Today: Legs B'));
    expect(screen.getByText('1 exercise')).toBeInTheDocument();
    expect(useWorkoutStore.getState().draft).toBeNull();
  });
});

describe('Dashboard — history widgets', () => {
  it('links the newest non-deleted workout of this profile only', async () => {
    const repo = installRepo(holder);
    const other = await repo.profiles.create({ name: 'Other' });
    const me = await repo.profiles.create({ name: 'Me' });
    await repo.profiles.setActive(me.id);
    const [older] = await seedLogs(repo, me.id, [
      { daysAgo: 2, sessionName: 'Older', exercises: [{ exerciseId: BENCH, sets: [{ kg: 100, reps: 5 }] }] },
      { daysAgo: 1, sessionName: 'Deleted Newest', deleted: true, exercises: [{ exerciseId: BENCH, sets: [{ kg: 100, reps: 5 }] }] },
    ]);
    await seedLogs(repo, other.id, [{ daysAgo: 0, sessionName: 'Other Profile', exercises: [{ exerciseId: BENCH, sets: [{ kg: 1, reps: 1 }] }] }]);
    render(<DashboardPage />);

    const link = await screen.findByRole('link', { name: 'Open workout Older' });
    expect(link).toHaveAttribute('href', `/history/${older.id}`);
    expect(screen.queryByText('Deleted Newest')).toBeNull();
    expect(screen.queryByText('Other Profile')).toBeNull();
    expect(within(link).getByText('1 set')).toBeInTheDocument();
  });

  it('shows weekly volume of done working sets in the profile units (lb)', async () => {
    const repo = installRepo(holder);
    const me = await repo.profiles.create({ name: 'Imperial', settings: { units: 'lb' } });
    await repo.profiles.setActive(me.id);
    await seedLogs(repo, me.id, [
      // Tue 09-22, this week: 2 × 100 kg × 5 = 1000 kg; the warm-up and the undone set do not count.
      {
        daysAgo: 1,
        exercises: [
          {
            exerciseId: SQUAT,
            sets: [
              { kg: 100, reps: 5 },
              { kg: 100, reps: 5 },
              { kg: 60, reps: 5, type: 'warmup' },
              { kg: 100, reps: 5, done: false },
            ],
          },
        ],
      },
      // Fri 09-18, last week: 80 × 10 = 800 kg.
      { daysAgo: 5, exercises: [{ exerciseId: SQUAT, sets: [{ kg: 80, reps: 10 }] }] },
    ]);
    render(<DashboardPage />);

    // 1000 kg × 2.20462 = 2204.62 → 2,204.6 lb; 800 kg × 2.20462 = 1763.696 → 1,763.7 lb.
    expect(await screen.findByTestId('dash-volume-this')).toHaveTextContent('2,204.6 lb');
    expect(screen.getByTestId('dash-volume-last')).toHaveTextContent('1,763.7 lb');
    // (1000 − 800) / 800 = +25 %.
    expect(screen.getByTestId('dash-volume-change')).toHaveTextContent('25% more than last week');
  });

  it('reports fried recovery for a heavy session inside 48 h, with the most loaded muscles', async () => {
    const repo = installRepo(holder);
    const me = await repo.profiles.ensureActive('Me');
    // Finished ~0.2 h ago. 7 done sets: Chest 7 × 0.95 = 6.65 ≥ 6 → fried; Triceps 7 × 0.65 = 4.55 and
    // Front delts 7 × 0.35 = 2.45 → recovering.
    const sets = Array.from({ length: 7 }, () => ({ kg: 100, reps: 5 }));
    await seedLogs(repo, me.id, [{ daysAgo: 0.05, exercises: [{ exerciseId: BENCH, sets }] }]);
    render(<DashboardPage />);

    expect(await screen.findByTestId('dash-recovery-overall', {}, { timeout: 4000 })).toHaveTextContent('Overall: Fried');
    expect(screen.getByTestId('dash-fried-hint')).toBeInTheDocument();
    const items = within(screen.getByTestId('dash-recovery-muscles')).getAllByRole('listitem');
    expect(items.map((li) => li.textContent?.split(/Fried|Recovering/)[0])).toEqual(['Chest', 'Triceps', 'Front delts']);
    expect(items[0]).toHaveTextContent('Fried');
    expect(items[1]).toHaveTextContent('Recovering');
  });

  it('is fresh when the last session ended more than 48 h ago', async () => {
    const repo = installRepo(holder);
    const me = await repo.profiles.ensureActive('Me');
    // Started 2.1 d = 50.4 h ago, finished 49.4 h ago: outside the 48 h window.
    await seedLogs(repo, me.id, [{ daysAgo: 2.1, exercises: [{ exerciseId: BENCH, sets: [{ kg: 100, reps: 5 }] }] }]);
    render(<DashboardPage />);

    expect(await screen.findByTestId('dash-recovery-overall', {}, { timeout: 4000 })).toHaveTextContent('Overall: Fresh');
    expect(screen.queryByTestId('dash-fried-hint')).toBeNull();
    expect(screen.getByText(/No muscle was trained in the last 48 h/)).toBeInTheDocument();
  });
});
