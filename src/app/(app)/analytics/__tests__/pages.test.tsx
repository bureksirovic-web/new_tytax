import 'fake-indexeddb/auto';
import { Suspense } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import type { Repository } from '@/contracts/repo';
import { createRepository, TytaxDatabase } from '@/lib/db';
import { readPins } from '@/components/analytics/use-analytics-data';
import { renderEn, seedLog } from '@/components/analytics/__tests__/helpers';

const holder = vi.hoisted(() => ({ repo: undefined as unknown, push: vi.fn() }));
vi.mock('@/lib/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/db')>();
  return { ...actual, getRepository: () => holder.repo };
});
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: holder.push }) }));

const { default: AnalyticsPage } = await import('../page-client');
const { default: ExerciseAnalyticsPage } = await import('../[exerciseId]/page-client');

const SWING = 'kb_swing_two-hand-swing';

let n = 0;
async function setup(units: 'kg' | 'lb' = 'kg'): Promise<{ repo: Repository; profileId: string }> {
  n += 1;
  const repo = createRepository({ db: new TytaxDatabase(`analytics-page-${n}`) });
  holder.repo = repo;
  const p = await repo.profiles.ensureActive('Me');
  await repo.profiles.updateSettings(p.id, { units });
  return { repo, profileId: p.id };
}

function renderDetail(id: string) {
  const value = { exerciseId: encodeURIComponent(id) };
  // A pre-resolved thenable (React's `use` reads status/value) so the page does not suspend in tests.
  const params = Object.assign(Promise.resolve(value), { status: 'fulfilled', value });
  return renderEn(
    <Suspense fallback={null}>
      <ExerciseAnalyticsPage params={params} />
    </Suspense>,
  );
}

describe('/analytics', () => {
  it('no logs: heading, empty state with a start CTA, bodyweight still usable', async () => {
    await setup();
    renderEn(<AnalyticsPage />);
    expect(screen.getByTestId('page-heading-analytics')).toHaveTextContent('Force analytics');
    expect(await screen.findByText('No workouts logged yet')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Start a workout' }));
    expect(holder.push).toHaveBeenCalledWith('/workout');
    expect(screen.getByLabelText('Bodyweight (kg)')).toBeInTheDocument();
  });

  it('with logs: sections render and a pinned exercise persists and shows its best e1RM in lb', async () => {
    const { repo, profileId } = await setup('lb');
    await seedLog(repo, profileId, 'a', 10, SWING, [{ kg: 20, reps: 10 }]);
    await seedLog(repo, profileId, 'b', 3, SWING, [{ kg: 24, reps: 8 }, { kg: 40, reps: 5, type: 'warmup' }]);
    renderEn(<AnalyticsPage />);
    expect(await screen.findByRole('heading', { name: 'Training load (ACWR)' })).toBeInTheDocument();
    for (const name of ['Muscle distribution', 'Training calendar', 'Exercise progress', 'Bodyweight', 'Best lifts', 'Pinned lifts']) {
      expect(screen.getByRole('heading', { level: 2, name })).toBeInTheDocument();
    }
    // 10 days of history → baseline still building
    expect(screen.getByTestId('ana-acwr-building')).toHaveTextContent('10 of 28 days');

    const edit = screen.getByRole('button', { name: 'Edit pinned' });
    await waitFor(() => expect(edit).toBeEnabled());
    fireEvent.click(edit);
    const dialog = await screen.findByRole('dialog');
    const box = await within(dialog).findByRole('checkbox');
    fireEvent.click(box);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(async () => expect(readPins((await repo.profiles.get(profileId))!.settings)).toEqual([SWING]));
    const pinned = await screen.findByTestId('ana-pinned-list');
    // best e1RM: 24×36/29 = 29.79 kg (the 40 kg warm-up never counts) → ×2.20462 = 65.7 lb
    expect(within(pinned).getAllByText('65.7 lb').length).toBeGreaterThan(0);
  });
});

describe('/analytics/[exerciseId]', () => {
  it('unknown exercise without history → not-found state, no spinner', async () => {
    await setup();
    renderDetail('no-such-exercise');
    expect(await screen.findByTestId('ana-exercise-not-found')).toBeInTheDocument();
    expect(screen.getByTestId('page-heading-analytics-exercise')).toHaveTextContent('Exercise not found');
  });

  it("history of another profile is not shown; own history is, in the profile's units", async () => {
    const { repo, profileId } = await setup('lb');
    const other = await repo.profiles.create({ name: 'Other' });
    await seedLog(repo, other.id, 'x', 2, 'custom-only', [{ kg: 50, reps: 5 }]);
    const view = renderDetail('custom-only');
    // a custom exercise that only another profile logged is not found here
    expect(await screen.findByTestId('ana-exercise-not-found')).toBeInTheDocument();
    view.unmount();

    await seedLog(repo, profileId, 'm', 2, SWING, [{ kg: 24, reps: 8 }]);
    renderDetail(SWING);
    const progress = await screen.findByTestId('ana-exercise-progress');
    // 24 × 36 / 29 = 29.79 kg e1RM → 65.7 lb
    expect(within(progress).getAllByText('65.7 lb').length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: 'Exercise details' })).toHaveAttribute('href', `/exercises/${SWING}`);
  });
});
