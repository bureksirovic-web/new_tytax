import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { savePins } from '@/components/analytics/pinned-storage';
import { BENCH, NOW, installRepo, seedLogs } from './dashboard-harness';

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

const GONE = '5f0c1a9e-custom-plank';
const NEVER = '0b7d-custom-never-logged';

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

describe('Dashboard — W2 S3: pinned exercise without catalog entry or live log', () => {
  it('shows the soft-deleted log\'s name snapshot, else "Removed exercise", never the raw id', async () => {
    const repo = installRepo(holder);
    const me = await repo.profiles.ensureActive('Me');
    await seedLogs(repo, me.id, [
      { daysAgo: 1, exercises: [{ exerciseId: BENCH, sets: [{ kg: 100, reps: 5 }] }] },
      { daysAgo: 4, deleted: true, exercises: [{ exerciseId: GONE, exerciseName: 'My plank', sets: [{ kg: 0, reps: 30 }] }] },
    ]);
    await savePins(repo, me.id, [GONE, NEVER]);
    render(<DashboardPage />);

    const card = await screen.findByTestId('dash-pinned', {}, { timeout: 4000 });
    await waitFor(() => expect(within(card).getByRole('link', { name: 'My plank: open progress' })).toBeInTheDocument());
    expect(within(card).getByRole('link', { name: 'Removed exercise: open progress' })).toBeInTheDocument();
    expect(card.textContent).not.toContain(GONE);
    expect(card.textContent).not.toContain(NEVER);
  });
});
