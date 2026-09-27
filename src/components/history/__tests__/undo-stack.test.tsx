import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { getRepository } from '@/lib/db';
import HistoryPage from '@/app/(app)/history/page-client';
import { useHistoryUndo } from '../undo-store';
import { en, renderEn, resetDb, seedLogs, seedProfile } from './test-utils';

vi.mock('next/navigation', async () => (await import('./test-utils')).navigationMock);

const BENCH = { exerciseId: 'bench', exerciseName: 'Bench', sets: [{ kg: 100, reps: 5 }] };

beforeEach(async () => {
  await resetDb();
  useHistoryUndo.setState({ pending: null, earlier: [] });
});

describe('Undo after two quick deletes (refuter1 S3)', () => {
  it('each delete keeps its own undo', async () => {
    const me = await seedProfile('Ana');
    await seedLogs(me.id, [
      { daysAgo: 5, sessionName: 'Monday', exercises: [BENCH] },
      { daysAgo: 3, sessionName: 'Wednesday', exercises: [BENCH] },
    ]);
    renderEn(<HistoryPage />);
    const del = async (name: string) => {
      const item = (await screen.findAllByTestId('history-item')).find((li) => li.textContent?.includes(name))!;
      fireEvent.click(item.querySelector('[data-testid="history-item-delete"]')!);
      await waitFor(() => expect(screen.queryByText(name)).toBeNull());
    };
    await del('Wednesday');
    await del('Monday');
    expect(screen.getByTestId('history-undo-bar')).toHaveTextContent(en('hist_deleted_n', { n: 2 }));
    fireEvent.click(screen.getByTestId('history-undo'));
    await screen.findByText('Monday');
    expect(screen.getByTestId('history-undo-bar')).toHaveTextContent(en('hist_deleted'));
    fireEvent.click(screen.getByTestId('history-undo'));
    await screen.findByText('Wednesday');
    const live = await getRepository().logs.list(me.id);
    expect(live.map((l) => l.sessionName).sort()).toEqual(['Monday', 'Wednesday']);
    await waitFor(() => expect(screen.queryByTestId('history-undo')).toBeNull());
  });
});
