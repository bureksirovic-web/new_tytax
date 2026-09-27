import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { buildWorkoutLog, sequentialIds } from '@/contracts/fixtures';
import { getRepository } from '@/lib/db';
import HistoryPage from '@/app/(app)/history/page-client';
import HistoryDetailPage from '@/app/(app)/history/[id]/page-client';
import { fromLog, hasErrors, validate } from '../edit-model';
import { UNDO_WINDOW_MS, useHistoryUndo } from '../undo-store';
import { UndoSnackbar } from '../undo-snackbar';
import { en, NOW, renderEn, resetDb, resolvedParams, router, seedLogs, seedProfile } from './test-utils';

vi.mock('next/navigation', async () => (await import('./test-utils')).navigationMock);

const BENCH = { exerciseId: 'bench', exerciseName: 'Bench', sets: [{ kg: 100, reps: 5 }] };
const SMITH = 'tytax_smith-machine_smith-flat-bench-press';

beforeEach(async () => {
  await resetDb();
  useHistoryUndo.setState({ pending: null, earlier: [] });
});

describe('history review fixes', () => {
  it('switching the active profile never keeps showing the previous profile’s list', async () => {
    const ana = await seedProfile('Ana');
    const ivo = await seedProfile('Ivo', 'kg', false);
    await seedLogs(ana.id, [{ daysAgo: 1, sessionName: 'Ana day', exercises: [BENCH] }]);
    await seedLogs(ivo.id, [{ daysAgo: 1, sessionName: 'Ivo day', exercises: [BENCH] }]);
    renderEn(<HistoryPage />);
    expect(await screen.findByText('Ana day')).toBeInTheDocument();
    // Hold Ivo's page back so the in-between render is observable.
    const repo = getRepository();
    const realList = repo.logs.list.bind(repo.logs);
    let release: () => void = () => {};
    const gate = new Promise<void>((r) => (release = r));
    const spy = vi.spyOn(repo.logs, 'list').mockImplementation(async (pid, opts) => {
      if (pid === ivo.id) await gate;
      return realList(pid, opts);
    });
    await act(() => repo.profiles.setActive(ivo.id));
    await waitFor(() => expect(screen.queryByText('Ana day')).toBeNull());
    expect(screen.queryAllByTestId('history-item-delete')).toHaveLength(0); // no stale delete buttons
    release();
    expect(await screen.findByText('Ivo day')).toBeInTheDocument();
    spy.mockRestore();
  });

  it('an expired undo is not offered after coming back to the list, and undo() refuses it', async () => {
    const me = await seedProfile('Ana');
    const [log] = await seedLogs(me.id, [{ daysAgo: 1, exercises: [BENCH] }]);
    await getRepository().logs.softDelete(me.id, log.id);
    // Deleted UNDO_WINDOW_MS + 1 s ago, e.g. the user left /history and returned.
    useHistoryUndo.setState({
      pending: { profileId: me.id, logId: log.id, token: 99, expiresAt: Date.now() - 1000 },
    });
    renderEn(<UndoSnackbar />);
    await waitFor(() => expect(useHistoryUndo.getState().pending).toBeNull());
    expect(screen.queryByRole('button', { name: en('hist_undo') })).toBeNull();
    useHistoryUndo.setState({
      pending: { profileId: me.id, logId: log.id, token: 100, expiresAt: Date.now() - 1 },
    });
    expect(await useHistoryUndo.getState().undo(getRepository())).toBe(false);
    expect(await getRepository().logs.get(me.id, log.id)).toBeUndefined();
  });

  it('a fresh delete opens the full undo window', async () => {
    const me = await seedProfile('Ana');
    const [log] = await seedLogs(me.id, [{ daysAgo: 1, exercises: [BENCH] }]);
    const before = Date.now();
    await useHistoryUndo.getState().remove(getRepository(), me.id, log.id);
    const pending = useHistoryUndo.getState().pending;
    expect(pending?.expiresAt).toBeGreaterThanOrEqual(before + UNDO_WINDOW_MS);
  });

  it('deleting on the detail page does not flash "not found" before the redirect', async () => {
    const me = await seedProfile('Ana');
    const [log] = await seedLogs(me.id, [{ daysAgo: 1, sessionName: 'Push', exercises: [BENCH] }]);
    renderEn(<HistoryDetailPage params={resolvedParams(log.id)} />);
    fireEvent.click(await screen.findByTestId('history-delete'));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/history'));
    await waitFor(() => expect(screen.queryByTestId('history-detail')).toBeNull());
    expect(screen.queryByTestId('history-not-found')).toBeNull();
  });

  it('shows the muscle impact of done working sets from the catalog', async () => {
    const me = await seedProfile('Ana');
    const [log] = await seedLogs(me.id, [
      {
        daysAgo: 1,
        exercises: [
          { exerciseId: SMITH, exerciseName: 'Smith bench', sets: [{ kg: 40, reps: 10, type: 'warmup' }, { kg: 80, reps: 5 }, { kg: 80, reps: 5 }] },
        ],
      },
    ]);
    renderEn(<HistoryDetailPage params={resolvedParams(log.id)} />);
    const panel = await screen.findByTestId('history-impact', {}, { timeout: 4000 });
    await waitFor(() => expect(within(panel).getAllByTestId('history-impact-row')).toHaveLength(3));
    const rows = within(panel).getAllByTestId('history-impact-row').map((r) => r.textContent);
    // Catalog impact: Chest 95, Triceps 65, Front Delts 35 → total 195 per set (same for both sets):
    // 95/195 = 48.7 → 49 %, 65/195 = 33.3 → 33 %, 35/195 = 17.9 → 18 %
    expect(rows).toEqual(['Chest49%', 'Triceps33%', 'Front delts18%']);
  });

  it('RPE: half steps from imports stay valid, out-of-range is rejected', () => {
    const log = buildWorkoutLog('p', { daysAgo: 1, rpe: 7.5, exercises: [BENCH] }, NOW, sequentialIds('r'));
    const draft = fromLog(log, 'kg');
    expect(hasErrors(validate(draft, 'kg', '2026-09-20'))).toBe(false);
    expect(validate({ ...draft, rpe: '10.5' }, 'kg', '2026-09-20').rpe).toBe(true);
    expect(validate({ ...draft, rpe: '7.3' }, 'kg', '2026-09-20').rpe).toBe(true);
    expect(validate({ ...draft, rpe: '0' }, 'kg', '2026-09-20').rpe).toBe(true);
  });
});
