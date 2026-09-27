import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { loadCatalog } from '@/lib/catalog';
import { savePins } from '@/components/analytics/pinned-storage';
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
  window.localStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('Dashboard — G3-03 next-session hook', () => {
  it('marks the predicted session with dashboard-next-session', async () => {
    const repo = installRepo(holder);
    const me = await repo.profiles.ensureActive('Me');
    await repo.programs.create(me.id, TEMPLATE, { activate: true });
    render(<DashboardPage />);

    const next = await screen.findByTestId('dashboard-next-session');
    expect(next).toHaveTextContent('Today: Push A');
    expect(next).toHaveTextContent('2 exercises');
  });
});

describe('Dashboard — G3-04 draft of another profile', () => {
  it('offers a switch to the owner instead of continue, and switching resumes it', async () => {
    const repo = installRepo(holder);
    const ana = await repo.profiles.create({ name: 'Ana' });
    const me = await repo.profiles.create({ name: 'Me' });
    await repo.profiles.setActive(me.id);
    useWorkoutStore.getState().startQuick(ana.id, 'Ana Legs');
    render(<DashboardPage />);

    expect(await screen.findByTestId('dash-foreign-title')).toHaveTextContent('Workout in progress for Ana');
    expect(screen.getByText(/"Ana Legs" was started on another profile/)).toBeInTheDocument();
    expect(screen.queryByTestId('dash-resume')).toBeNull();
    expect(screen.queryByTestId('dash-quick-start')).toBeNull();

    fireEvent.click(screen.getByTestId('dash-foreign-switch'));
    await waitFor(async () => expect(await repo.profiles.getActiveId()).toBe(ana.id));
    const resume = await screen.findByTestId('dash-resume');
    expect(resume).toHaveTextContent('Continue: Ana Legs');
    expect(screen.queryByTestId('dash-foreign-draft')).toBeNull();
    expect(useWorkoutStore.getState().draft?.profileId).toBe(ana.id);
  });

  it('for a deleted owner offers only a confirmed discard', async () => {
    const repo = installRepo(holder);
    const gone = await repo.profiles.create({ name: 'Gone' });
    const me = await repo.profiles.create({ name: 'Me' });
    await repo.profiles.setActive(me.id);
    useWorkoutStore.getState().startQuick(gone.id, 'Orphan');
    await repo.profiles.remove(gone.id);
    render(<DashboardPage />);

    expect(await screen.findByText(/"Orphan" was started on a profile that no longer exists/)).toBeInTheDocument();
    expect(screen.getByTestId('dash-foreign-title')).toHaveTextContent('Workout in progress for another profile');
    expect(screen.queryByTestId('dash-foreign-switch')).toBeNull();

    fireEvent.click(screen.getByTestId('dash-foreign-discard'));
    const dialog = screen.getByRole('dialog', { name: 'Discard this workout?' });
    fireEvent.click(within(dialog).getByTestId('dash-foreign-discard-cancel'));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(useWorkoutStore.getState().draft?.sessionName).toBe('Orphan');

    fireEvent.click(screen.getByTestId('dash-foreign-discard'));
    fireEvent.click(screen.getByTestId('dash-foreign-discard-confirm'));
    expect(useWorkoutStore.getState().draft).toBeNull();
    expect(await screen.findByTestId('dash-no-program')).toBeInTheDocument();
    expect(screen.queryByTestId('dash-foreign-draft')).toBeNull();
  });
});

describe('Dashboard — pinned exercises', () => {
  it('lists pins with the best e1RM of their latest session, in profile units, linking to analytics', async () => {
    const repo = installRepo(holder);
    const me = await repo.profiles.create({ name: 'Imperial', settings: { units: 'lb' } });
    await repo.profiles.setActive(me.id);
    await seedLogs(repo, me.id, [
      // Older session: 100 kg × 5 → 100 × 36 / 32 = 112.5 kg (not the latest, ignored).
      { daysAgo: 3, exercises: [{ exerciseId: BENCH, sets: [{ kg: 100, reps: 5 }] }] },
      // Latest: 90 × 10 → 90 × 36 / 27 = 120 kg; 110 × 15 (above the 12-rep cap) and a 150 kg warm-up never count.
      {
        daysAgo: 1,
        exercises: [
          {
            exerciseId: BENCH,
            sets: [{ kg: 90, reps: 10 }, { kg: 110, reps: 15 }, { kg: 150, reps: 3, type: 'warmup' }],
          },
          // Only a warm-up for the squat → no e1RM.
          { exerciseId: SQUAT, sets: [{ kg: 60, reps: 5, type: 'warmup' }] },
        ],
      },
    ]);
    await savePins(repo, me.id, [BENCH, SQUAT]);
    const catalog = await loadCatalog();
    const benchName = catalog.getById(BENCH)?.name ?? '';
    const squatName = catalog.getById(SQUAT)?.name ?? '';
    render(<DashboardPage />);

    const card = await screen.findByTestId('dash-pinned', {}, { timeout: 4000 });
    const items = within(card).getAllByTestId('dash-pinned-item');
    expect(items.map((li) => li.getAttribute('data-exercise-id'))).toEqual([BENCH, SQUAT]);
    // 120 kg × 2.20462 = 264.5544 → 264.6 lb.
    const bench = await within(card).findByRole('link', { name: `${benchName}: open progress` }, { timeout: 4000 });
    expect(bench).toHaveAttribute('href', `/analytics/${encodeURIComponent(BENCH)}`);
    expect(within(items[0]).getByTestId('dash-pinned-value')).toHaveTextContent('264.6 lb');
    expect(within(card).getByRole('link', { name: `${squatName}: open progress` })).toBeInTheDocument();
    expect(within(items[1]).getByTestId('dash-pinned-value')).toHaveTextContent('No e1RM yet');
  });

  it('is hidden when the profile has no pins', async () => {
    const repo = installRepo(holder);
    const me = await repo.profiles.ensureActive('Me');
    await seedLogs(repo, me.id, [{ daysAgo: 1, exercises: [{ exerciseId: BENCH, sets: [{ kg: 100, reps: 5 }] }] }]);
    render(<DashboardPage />);

    expect(await screen.findByTestId('dash-last-workout')).toBeInTheDocument();
    expect(screen.queryByTestId('dash-pinned')).toBeNull();
    expect(screen.queryByTestId('dash-pinned-error')).toBeNull();
  });
});
