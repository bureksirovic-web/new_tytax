import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { getRepository } from '@/lib/db';
import HistoryPage from '@/app/(app)/history/page-client';
import { useHistoryUndo, UNDO_WINDOW_MS } from '../undo-store';
import { en, renderEn, resetDb, seedLogs, seedProfile, seriousViolations } from './test-utils';

vi.mock('next/navigation', async () => (await import('./test-utils')).navigationMock);

const BENCH = { exerciseId: 'bench', exerciseName: 'Bench', sets: [{ kg: 100, reps: 5 }, { kg: 100, reps: 5 }] };

beforeEach(async () => {
  await resetDb();
  useHistoryUndo.setState({ pending: null, earlier: [] });
});
afterEach(() => {
  vi.useRealTimers();
});

const names = () => screen.getAllByTestId('history-item').map((li) => li.querySelector('p')?.textContent ?? '');

describe('History list', () => {
  it('lists only the active profile’s non-deleted logs, newest first', async () => {
    const me = await seedProfile('Ana');
    const other = await seedProfile('Ivo', 'kg', false);
    await seedLogs(me.id, [
      { daysAgo: 5, sessionName: 'Old', exercises: [BENCH] },
      { daysAgo: 1, sessionName: 'New', exercises: [BENCH] },
      { daysAgo: 2, sessionName: 'Gone', deleted: true, exercises: [BENCH] },
    ]);
    await seedLogs(other.id, [{ daysAgo: 0, sessionName: 'Foreign', exercises: [BENCH] }]);
    renderEn(<HistoryPage />);
    await screen.findAllByTestId('history-item');
    expect(names()).toEqual(['New', 'Old']);
    expect(screen.getByTestId('history-count')).toHaveTextContent(en('hist_sessions_count', { n: 2 }));
    expect(screen.queryByText('Foreign')).toBeNull();
    expect(screen.queryByText('Gone')).toBeNull();
    expect(screen.getByTestId('page-heading-history')).toHaveTextContent(en('hist_title'));
  });

  it('shows volume in the profile’s units and done working sets only', async () => {
    const me = await seedProfile('Ana', 'lb');
    await seedLogs(me.id, [
      { daysAgo: 1, exercises: [{ exerciseId: 'b', sets: [{ kg: 100, reps: 5 }, { kg: 60, reps: 5, type: 'warmup' }, { kg: 100, reps: 5, done: false }] }] },
    ]);
    renderEn(<HistoryPage />);
    // Volume = 100×5 = 500 kg (warm-up and undone excluded) × 2.20462 = 1102.31 → 1,102.3 lb
    expect(await screen.findByTestId('history-item-volume')).toHaveTextContent('1,102.3 lb');
    // 1: only the done working set counts.
    expect(screen.getByTestId('history-item-sets')).toHaveTextContent(/^1$/);
    expect(screen.getByTestId('history-item-exercises')).toHaveTextContent('b');
  });

  it('shows the empty state with a link to start a workout', async () => {
    await seedProfile('Ana');
    renderEn(<HistoryPage />);
    const empty = await screen.findByTestId('history-empty');
    expect(within(empty).getByRole('link', { name: en('hist_empty_cta') })).toHaveAttribute('href', '/workout');
    expect(screen.queryByTestId('history-item')).toBeNull();
  });

  it('loads 20 at a time with "Load more"', async () => {
    const me = await seedProfile('Ana');
    await seedLogs(me.id, Array.from({ length: 23 }, (_, i) => ({ daysAgo: i, sessionName: `S${i}`, exercises: [BENCH] })));
    renderEn(<HistoryPage />);
    await waitFor(() => expect(screen.getAllByTestId('history-item')).toHaveLength(20));
    fireEvent.click(screen.getByTestId('history-load-more'));
    await waitFor(() => expect(screen.getAllByTestId('history-item')).toHaveLength(23));
    expect(screen.queryByTestId('history-load-more')).toBeNull();
  });

  it('soft-deletes with undo; undo brings the log back', async () => {
    const me = await seedProfile('Ana');
    const [log] = await seedLogs(me.id, [{ daysAgo: 1, sessionName: 'Leg day', exercises: [BENCH] }]);
    renderEn(<HistoryPage />);
    fireEvent.click(await screen.findByTestId('history-item-delete'));
    await screen.findByTestId('history-empty');
    expect(await getRepository().logs.get(me.id, log.id)).toBeUndefined();
    expect(await getRepository().logs.get(me.id, log.id, { includeDeleted: true })).toBeDefined();
    expect(screen.getByTestId('history-undo-bar')).toHaveTextContent(en('hist_deleted'));
    fireEvent.click(screen.getByRole('button', { name: en('hist_undo') }));
    expect(await screen.findByText('Leg day')).toBeInTheDocument();
    expect((await getRepository().logs.get(me.id, log.id))?.deletedAt).toBeUndefined();
  });

  it('the undo window closes after UNDO_WINDOW_MS', async () => {
    const me = await seedProfile('Ana');
    await seedLogs(me.id, [{ daysAgo: 1, exercises: [BENCH] }]);
    vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ['setTimeout', 'clearTimeout'] });
    renderEn(<HistoryPage />);
    fireEvent.click(await screen.findByTestId('history-item-delete'));
    await screen.findByRole('button', { name: en('hist_undo') });
    act(() => vi.advanceTimersByTime(UNDO_WINDOW_MS - 500));
    expect(screen.getByRole('button', { name: en('hist_undo') })).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(600));
    expect(screen.queryByRole('button', { name: en('hist_undo') })).toBeNull();
  });

  it('has no serious axe violations', async () => {
    const me = await seedProfile('Ana');
    await seedLogs(me.id, [{ daysAgo: 1, exercises: [BENCH] }]);
    const { container } = renderEn(<HistoryPage />);
    await screen.findAllByTestId('history-item');
    expect(await seriousViolations(container)).toEqual([]);
  });
});
