import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import type { WorkoutLog } from '@/contracts/domain';
import { getDb, getRepository } from '@/lib/db';
import HistoryPage from '@/app/(app)/history/page-client';
import HistoryDetailPage from '@/app/(app)/history/[id]/page-client';
import { useHistoryUndo } from '../undo-store';
import { en, NOW, renderEn, resetDb, resolvedParams, seedLogs, seedProfile, seriousViolations } from './test-utils';

vi.mock('next/navigation', async () => (await import('./test-utils')).navigationMock);

beforeEach(async () => {
  await resetDb();
  useHistoryUndo.setState({ pending: null, earlier: [] });
});

/**
 * Puts rows straight into the Dexie table, below the repository, as data stored
 * by an older build or a hand-edited backup would sit there. Not through
 * importBackup: G2's repository (Wave 2) now rightly rejects malformed rows on
 * import, so the damaged rows can only exist as legacy stored data.
 */
async function storeRaw(rows: Record<string, unknown>[]) {
  await getDb().workoutLogs.bulkPut(rows as unknown as WorkoutLog[]);
}

const BENCH = { exerciseId: 'bench', exerciseName: 'Bench', sets: [{ kg: 100, reps: 5 }] };

describe('History with damaged stored rows (refuter1 S2/S3)', () => {
  it('renders a row without exercises as a deletable damaged entry instead of crashing', async () => {
    const me = await seedProfile('Ana');
    await seedLogs(me.id, [{ daysAgo: 1, sessionName: 'Good', exercises: [BENCH] }]);
    await storeRaw([{ id: 'log-bad', profileId: me.id, date: '2026-09-15', sessionName: 'From the file', startedAt: NOW.toISOString(), finishedAt: NOW.toISOString(), durationSeconds: 3600 }]);
    renderEn(<HistoryPage />);
    const damaged = await screen.findByTestId('history-item-damaged');
    expect(damaged).toHaveTextContent(en('hist_damaged'));
    expect(screen.getAllByTestId('history-item')).toHaveLength(1);
    expect(await seriousViolations(document.body)).toEqual([]);
    fireEvent.click(screen.getByRole('button', { name: en('hist_delete_damaged', { name: 'From the file' }) }));
    await waitFor(() => expect(screen.queryByTestId('history-item-damaged')).toBeNull());
    expect((await getRepository().logs.get(me.id, 'log-bad'))?.deletedAt ?? 'gone').toBeTruthy();
  });

  it('never shows NaN for a row without totals', async () => {
    const me = await seedProfile('Ana');
    await storeRaw([{ id: 'log-nt', profileId: me.id, date: '2026-09-15', sessionName: 'No totals', startedAt: NOW.toISOString(), finishedAt: NOW.toISOString(), durationSeconds: 60, exercises: [] }]);
    renderEn(<HistoryPage />);
    await screen.findByTestId('history-list');
    expect(screen.getByTestId('history-list')).not.toHaveTextContent('NaN');
  });

  it('count and list agree when a row has no date; "Load more" is not a dead end', async () => {
    const me = await seedProfile('Ana');
    await seedLogs(me.id, [{ daysAgo: 1, sessionName: 'Good', exercises: [BENCH] }]);
    await storeRaw([{ id: 'log-nd', profileId: me.id, sessionName: 'No date', startedAt: NOW.toISOString() }]);
    renderEn(<HistoryPage />);
    await screen.findAllByTestId('history-item');
    expect(screen.getByTestId('history-count')).toHaveTextContent(en('hist_sessions_count', { n: 1 }));
    expect(screen.queryByTestId('history-load-more')).toBeNull();
  });

  it('the detail page of a damaged row offers delete instead of crashing', async () => {
    const me = await seedProfile('Ana');
    await storeRaw([{ id: 'log-bad', profileId: me.id, date: '2026-09-15', sessionName: 'From the file', startedAt: NOW.toISOString(), durationSeconds: 60 }]);
    renderEn(<HistoryDetailPage params={resolvedParams('log-bad')} />);
    expect(await screen.findByTestId('history-item-damaged')).toBeInTheDocument();
    expect(await seriousViolations(document.body)).toEqual([]);
    fireEvent.click(screen.getByRole('button', { name: en('hist_delete_damaged', { name: 'From the file' }) }));
    await waitFor(() => expect(useHistoryUndo.getState().pending?.logId).toBe('log-bad'));
  });
});
