import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import type { Repository } from '@/contracts/repo';
import { createRepository, TytaxDatabase } from '@/lib/db';
import { savePins } from '@/components/analytics/use-analytics-data';
import { useUIStore } from '@/stores/ui-store';
import { renderEn, seedLog } from '@/components/analytics/__tests__/helpers';

const holder = vi.hoisted(() => ({ repo: undefined as unknown, push: vi.fn() }));
vi.mock('@/lib/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/db')>();
  return { ...actual, getRepository: () => holder.repo };
});
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: holder.push }) }));

const { default: AnalyticsPage } = await import('../page-client');

const SWING = 'kb_swing_two-hand-swing';
const CUSTOM = '5f0c1a9e-custom-plank';

let n = 0;
async function setup(): Promise<{ repo: Repository; profileId: string }> {
  n += 1;
  const repo = createRepository({ db: new TytaxDatabase(`analytics-pinned-name-${n}`) });
  holder.repo = repo;
  const p = await repo.profiles.ensureActive('Me');
  return { repo, profileId: p.id };
}

describe('W2 S3: a pinned exercise that is neither in the catalog nor in live logs', () => {
  beforeEach(() => {
    localStorage.clear();
    useUIStore.setState({ toasts: [] });
  });

  it('uses the name snapshot of a soft-deleted log, never the raw id (also in the chart text)', async () => {
    const { repo, profileId } = await setup();
    // A live log of another exercise so the screen is not in its empty state.
    await seedLog(repo, profileId, 'live', 2, SWING, [{ kg: 24, reps: 8 }]);
    await seedLog(repo, profileId, 'gone', 5, CUSTOM, [{ kg: 0, reps: 30 }]);
    await repo.logs.softDelete(profileId, 'gone');
    await savePins(repo, profileId, [CUSTOM]);
    renderEn(<AnalyticsPage />);
    const pinned = await screen.findByTestId('ana-pinned-list');
    await waitFor(() => expect(within(pinned).getByRole('link', { name: `snap-${CUSTOM}` })).toBeInTheDocument());
    expect(pinned.textContent).not.toMatch(new RegExp(`(^|[^-])${CUSTOM}`));
  });

  it('with no log at all it shows "Removed exercise"', async () => {
    const { repo, profileId } = await setup();
    await seedLog(repo, profileId, 'live', 2, SWING, [{ kg: 24, reps: 8 }]);
    await savePins(repo, profileId, [CUSTOM]);
    renderEn(<AnalyticsPage />);
    const pinned = await screen.findByTestId('ana-pinned-list');
    await waitFor(() => expect(within(pinned).getByRole('link', { name: 'Removed exercise' })).toBeInTheDocument());
    expect(within(pinned).getByText('Removed exercise e1RM trend: no data')).toBeInTheDocument();
    expect(pinned.textContent).not.toContain(CUSTOM);
  });
});
