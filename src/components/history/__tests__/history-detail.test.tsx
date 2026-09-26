import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { getRepository } from '@/lib/db';
import HistoryDetailPage from '@/app/(app)/history/[id]/page-client';
import { useHistoryUndo } from '../undo-store';
import { en, renderEn, resetDb, resolvedParams, router, seedLogs, seedProfile, seriousViolations } from './test-utils';

vi.mock('next/navigation', async () => (await import('./test-utils')).navigationMock);

beforeEach(async () => {
  await resetDb();
  useHistoryUndo.setState({ pending: null, earlier: [] });
});

const renderDetail = (id: string) => renderEn(<HistoryDetailPage params={resolvedParams(id)} />);

async function seedOne(units: 'kg' | 'lb' = 'kg') {
  const me = await seedProfile('Ana', units);
  const [log] = await seedLogs(me.id, [
    {
      daysAgo: 1,
      sessionName: 'Push A',
      durationSeconds: 1800,
      rpe: 8,
      notes: 'Felt strong',
      exercises: [
        {
          exerciseId: 'bench',
          exerciseName: 'Bench',
          sets: [
            { kg: 50, reps: 10, type: 'warmup' },
            { kg: 100, reps: 5, rir: 2 },
            { kg: 100, reps: 5, rir: 1 },
            { kg: 100, reps: 5, done: false },
          ],
        },
        { exerciseId: 'row', exerciseName: 'Row', sets: [{ kg: 30, reps: 10 }] },
        { exerciseId: 'curl', exerciseName: 'Curl', sets: [{ kg: 10, reps: 10, done: false }] },
      ],
    },
  ]);
  return { me, log };
}

describe('History detail', () => {
  it('shows totals that exclude warm-ups/undone, marks warm-ups and hides skipped exercises', async () => {
    const { log } = await seedOne();
    renderDetail(log.id);
    expect(await screen.findByTestId('page-heading-history-detail')).toHaveTextContent('Push A');
    // 500 + 500 + 300 = 1 300 kg; 30 min → 43 kg/min; RIR (2+1)/2 = 1.5
    expect(screen.getByTestId('history-metric-volume')).toHaveTextContent('1,300 kg');
    expect(screen.getByTestId('history-metric-density')).toHaveTextContent('43 kg/min');
    expect(screen.getByTestId('history-metric-intensity')).toHaveTextContent('@1.5');
    expect(screen.getByTestId('history-metric-sets')).toHaveTextContent('3');
    expect(screen.getByTestId('history-rpe')).toHaveTextContent('8');
    expect(screen.getByTestId('history-notes')).toHaveTextContent('Felt strong');
    const [bench] = screen.getAllByTestId('history-exercise');
    const rows = within(bench).getAllByTestId('history-set');
    expect(rows).toHaveLength(3); // warm-up + 2 done working sets; undone hidden
    expect(within(rows[0]).getByTitle(en('hist_warmup_set'))).toHaveTextContent(en('hist_warmup_tag'));
    expect(within(bench).getByTestId('history-exercise-volume')).toHaveTextContent('1,000 kg');
    expect(screen.getAllByTestId('history-exercise')).toHaveLength(2);
    expect(screen.getByTestId('history-skipped')).toHaveTextContent(en('hist_skipped_hidden', { n: 1 }));
    fireEvent.click(screen.getByRole('button', { name: en('hist_show_undone') }));
    expect(within(bench).getAllByTestId('history-set')).toHaveLength(4);
  });

  it('applies lb units', async () => {
    const { log } = await seedOne('lb');
    renderDetail(log.id);
    // 1300 kg × 2.20462 = 2866.006 → 2,866 lb
    expect(await screen.findByTestId('history-metric-volume')).toHaveTextContent('2,866 lb');
  });

  it.each([
    ['unknown', async () => 'nope'],
    ['deleted', async () => {
      const me = await seedProfile('Ana');
      return (await seedLogs(me.id, [{ daysAgo: 1, deleted: true, exercises: [] }]))[0].id;
    }],
    ['another profile', async () => {
      await seedProfile('Ana');
      const other = await seedProfile('Ivo', 'kg', false);
      return (await seedLogs(other.id, [{ daysAgo: 1, exercises: [] }]))[0].id;
    }],
  ])('shows not-found for an %s id', async (_label, makeId) => {
    const id = await makeId();
    renderDetail(id);
    expect(await screen.findByTestId('history-not-found')).toBeInTheDocument();
    expect(screen.getByTestId('page-heading-history-detail')).toHaveTextContent(en('hist_not_found'));
    expect(screen.getByRole('link', { name: en('hist_back') })).toHaveAttribute('href', '/history');
  });

  it('deletes with undo and returns to the list', async () => {
    const { me, log } = await seedOne();
    renderDetail(log.id);
    fireEvent.click(await screen.findByTestId('history-delete'));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/history'));
    expect(await getRepository().logs.get(me.id, log.id)).toBeUndefined();
    expect(useHistoryUndo.getState().pending?.logId).toBe(log.id);
    fireEvent.click(await screen.findByRole('button', { name: en('hist_undo') }));
    expect(await screen.findByTestId('history-detail')).toBeInTheDocument();
    expect(await getRepository().logs.get(me.id, log.id)).toBeDefined();
  });

  it('links edit and has no serious axe violations', async () => {
    const { log } = await seedOne();
    const { container } = renderDetail(log.id);
    expect(await screen.findByTestId('history-edit')).toHaveAttribute('href', `/history/${log.id}/edit`);
    expect(await seriousViolations(container)).toEqual([]);
  });
});
