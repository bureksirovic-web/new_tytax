import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, renderHook, screen, waitFor } from '@testing-library/react';
import type { Repository } from '@/contracts/repo';
import { NOW, BENCH, TEMPLATE, installRepo, seedLogs } from './dashboard-harness';

const holder = vi.hoisted(() => ({
  repo: undefined as unknown,
  push: vi.fn(),
  locale: 'en' as 'en' | 'hr',
  catalogFails: false,
}));

vi.mock('@/lib/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/db')>();
  return { ...actual, getRepository: () => holder.repo };
});
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: holder.push }) }));
vi.mock('@/components/providers', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/components/providers')>();
  const i18n = await import('@/lib/i18n');
  type Key = Parameters<typeof i18n.t>[0];
  return {
    ...actual,
    useLocale: () => ({ locale: holder.locale, setLocale: () => {}, t: (k: Key) => i18n.t(k, holder.locale) }),
  };
});
vi.mock('@/hooks/use-exercises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/hooks/use-exercises')>();
  return {
    ...actual,
    useCatalog: (...args: Parameters<typeof actual.useCatalog>) =>
      holder.catalogFails ? { catalog: undefined, loading: false, error: new Error('chunk 404') } : actual.useCatalog(...args),
  };
});

const { default: DashboardPage } = await import('@/app/(app)/dashboard/page-client');
const { useStartWorkout } = await import('@/app/(app)/dashboard/_components/use-start-workout');
const { useWorkoutStore } = await import('@/stores/workout-store');

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  useWorkoutStore.setState({ draft: null });
  holder.locale = 'en';
  holder.catalogFails = false;
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('Dashboard — failures are shown, never an endless skeleton or a false empty state', () => {
  it('shows a recovery error when the exercise catalog cannot load', async () => {
    holder.catalogFails = true;
    const repo = installRepo(holder);
    const me = await repo.profiles.ensureActive('Me');
    await seedLogs(repo, me.id, [{ daysAgo: 0.1, exercises: [{ exerciseId: BENCH, sets: [{ kg: 50, reps: 5 }] }] }]);
    render(<DashboardPage />);

    expect(await screen.findByTestId('dash-recovery-failed')).toHaveTextContent('Recovery is unavailable');
    expect(screen.queryByTestId('dash-recovery-overall')).toBeNull();
    // The other cards still work.
    expect(screen.getByTestId('dash-weekly-volume')).toBeInTheDocument();
  });

  it('shows an alert instead of "No workouts yet" when a repository read fails', async () => {
    const repo = installRepo(holder);
    await repo.profiles.ensureActive('Me');
    repo.logs.list = () => Promise.reject(new Error('IndexedDB blocked'));
    render(<DashboardPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent('could not be loaded');
    expect(screen.queryByTestId('dash-no-workouts')).toBeNull();
    expect(screen.queryByTestId('dash-no-program')).toBeNull();
  });
});

describe('Dashboard — Croatian (default language)', () => {
  it('renders Croatian copy with the "few" plural form', async () => {
    holder.locale = 'hr';
    const repo = installRepo(holder);
    const me = await repo.profiles.ensureActive('Ja');
    await repo.programs.create(me.id, TEMPLATE, { activate: true });
    render(<DashboardPage />);

    expect(await screen.findByTestId('page-heading-dashboard')).toHaveTextContent('Početna');
    expect(await screen.findByTestId('dash-session-name')).toHaveTextContent('Danas: Push A');
    // Push A has 2 exercises: hr plural of 2 is "few" → "vježbe" (not "vježbi").
    expect(screen.getByText('2 vježbe')).toBeInTheDocument();
    expect(screen.getByText('Još nema treninga')).toBeInTheDocument();
  });
});

describe('useStartWorkout — never replaces a draft', () => {
  async function setup(): Promise<{ repo: Repository; profileId: string }> {
    const repo = installRepo(holder);
    const me = await repo.profiles.ensureActive('Me');
    return { repo, profileId: me.id };
  }

  it('starts only once when tapped twice in the same render', async () => {
    const { repo, profileId } = await setup();
    await repo.programs.create(profileId, TEMPLATE, { activate: true });
    const { result } = renderHook(() => useStartWorkout(profileId));
    await waitFor(() => expect(result.current.hydrated).toBe(true));

    // The dashboard starts today's session of the active program (the one it shows).
    const start = result.current.program;
    await act(async () => {
      await Promise.all([start(), start()]);
    });
    expect(holder.push).toHaveBeenCalledTimes(1);
    expect(useWorkoutStore.getState().draft?.sessionName).toBe('Push A');
  });

  it('opens an existing draft instead of overwriting it when the handler is stale', async () => {
    const { repo, profileId } = await setup();
    await repo.programs.create(profileId, TEMPLATE, { activate: true });
    const { result } = renderHook(() => useStartWorkout(profileId));
    await waitFor(() => expect(result.current.hydrated).toBe(true));

    const staleStart = result.current.program; // captured while there is no draft
    const staleQuick = result.current.quick;
    const existing = useWorkoutStore.getState().startQuick(profileId, 'Keep Me');
    await act(async () => {
      await staleStart();
      await staleQuick();
    });
    expect(useWorkoutStore.getState().draft?.id).toBe(existing.id);
    expect(useWorkoutStore.getState().draft?.sessionName).toBe('Keep Me');
    expect(holder.push).toHaveBeenCalledWith('/workout/active');
  });
});
