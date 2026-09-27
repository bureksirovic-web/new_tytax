import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import type { WorkoutLog } from '@/contracts/domain';
import { buildWorkoutLog, sequentialIds } from '@/contracts/fixtures';
import { getRepository } from '@/lib/db';
import HistoryPage from '@/app/(app)/history/page-client';
import HistoryDetailPage from '@/app/(app)/history/[id]/page-client';
import HistoryEditPage from '@/app/(app)/history/[id]/edit/page-client';
import { en, NOW, renderEn, resetDb, resolvedParams, router, seedProfile, seriousViolations } from './test-utils';

vi.mock('next/navigation', async () => (await import('./test-utils')).navigationMock);

beforeEach(resetDb);

/** Bench 2×100×5 (kg) + Plank holds: warm-up 20 s, 45 s, 60 s, undone 30 s (durations set after build). */
async function seedTimed(): Promise<{ profileId: string; log: WorkoutLog }> {
  const me = await seedProfile('Ana');
  const log = buildWorkoutLog(
    me.id,
    {
      daysAgo: 1,
      sessionName: 'Core',
      durationSeconds: 1200,
      exercises: [
        { exerciseId: 'bench', exerciseName: 'Bench', sets: [{ kg: 100, reps: 5 }, { kg: 100, reps: 5 }] },
        {
          exerciseId: 'plank',
          exerciseName: 'Plank',
          sets: [
            { kg: 0, reps: 0, type: 'warmup' },
            { kg: 0, reps: 0, rir: 1 },
            { kg: 0, reps: 0 },
            { kg: 0, reps: 0, done: false },
          ],
        },
      ],
    },
    NOW,
    sequentialIds('t'),
  );
  [20, 45, 60, 30].forEach((sec, i) => (log.exercises[1].sets[i].durationSeconds = sec));
  await getRepository().importBackup({
    format: 'tytax-backup',
    version: 3,
    exportedAt: NOW.toISOString(),
    profiles: [],
    workoutLogs: [log],
    programs: [],
    prRecords: [],
    bodyweightEntries: [],
    exerciseNotes: [],
    arsenal: [],
    equipment: [],
  });
  return { profileId: me.id, log };
}

describe('History: time-measured sets', () => {
  it('detail shows mm:ss instead of kg×reps, no e1RM, and a hold total without kg volume', async () => {
    const { log } = await seedTimed();
    const { container } = renderEn(<HistoryDetailPage params={resolvedParams(log.id)} />);
    await screen.findByTestId('page-heading-history-detail');
    // kg volume is bench only: 2 × 100 × 5 = 1 000 kg; hold = 45 + 60 = 105 s (warm-up and undone excluded)
    expect(screen.getByTestId('history-metric-volume')).toHaveTextContent('1,000 kg');
    expect(screen.getByTestId('history-metric-hold')).toHaveTextContent('01:45');
    const [bench, plank] = screen.getAllByTestId('history-exercise');
    expect(within(bench).getByTestId('history-exercise-volume')).toHaveTextContent('1,000 kg');
    expect(within(bench).queryByTestId('history-exercise-hold')).toBeNull();
    expect(within(plank).queryByTestId('history-exercise-volume')).toBeNull();
    expect(within(plank).getByTestId('history-exercise-hold')).toHaveTextContent(en('hist_hold_value', { time: '01:45' }));
    expect(within(plank).getByRole('columnheader', { name: en('hist_col_time') })).toBeInTheDocument();
    expect(within(plank).queryByRole('columnheader', { name: en('hist_col_load') })).toBeNull();
    // undone hidden by default: warm-up 00:20, 00:45, 01:00
    const cells = within(plank).getAllByTestId('history-set-duration').map((c) => c.textContent);
    expect(cells).toEqual(['00:20', '00:45', '01:00']);
    const rows = within(plank).getAllByTestId('history-set');
    expect(rows[1]).not.toHaveTextContent('kg');
    expect(await seriousViolations(container)).toEqual([]);
  });

  it('editor edits the duration as mm:ss, keeps time sets out of e1RM and rejects a bad clock', async () => {
    const { profileId, log } = await seedTimed();
    renderEn(<HistoryEditPage params={resolvedParams(log.id)} />);
    await screen.findByTestId('page-heading-history-edit');
    const [bench, plank] = screen.getAllByTestId('history-edit-exercise');
    expect(within(bench).queryByTestId('history-edit-duration')).toBeNull();
    expect(within(plank).queryAllByLabelText(/^Weight/)).toHaveLength(0);
    const durations = within(plank).getAllByTestId('history-edit-duration');
    expect(durations.map((d) => (d as HTMLInputElement).value)).toEqual(['00:20', '00:45', '01:00', '00:30']);

    fireEvent.change(durations[1], { target: { value: '1:75' } });
    fireEvent.click(screen.getByTestId('history-edit-save'));
    await waitFor(() => expect(within(plank).getAllByTestId('history-edit-duration')[1]).toHaveAttribute('aria-invalid', 'true'));
    expect(router.push).not.toHaveBeenCalled();

    fireEvent.change(within(plank).getAllByTestId('history-edit-duration')[1], { target: { value: '1:30' } });
    fireEvent.click(within(plank).getByTestId('history-edit-add-set')); // copies the last set: 00:30, done
    fireEvent.click(screen.getByTestId('history-edit-save'));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith(`/history/${log.id}`));
    const saved = await getRepository().logs.get(profileId, log.id);
    const sets = saved!.exercises[1].sets;
    expect(sets.map((s) => s.durationSeconds)).toEqual([20, 90, 60, 30, 30]);
    // The editor sends no e1RM for time sets (edit-model unit test); the stored value is the repo's (G4-W2-16).
    expect(sets[4]).toMatchObject({ type: 'working', done: true, kg: 0, reps: 0 });
    expect(sets[1].rir).toBe(1);
    // bench untouched: still 1 000 kg (time sets carry 0 kg)
    expect(saved?.totalVolumeKg).toBe(1000);
  });

  it('list item shows the log hold total next to the kg volume (G3-W2-03)', async () => {
    await seedTimed();
    renderEn(<HistoryPage />);
    const item = await screen.findByTestId('history-item');
    // Done working holds only: 45 s + 60 s (the warm-up 20 s and the undone 30 s do not count).
    expect(within(item).getByTestId('history-item-hold')).toHaveTextContent(en('hist_hold_value', { time: '01:45' }));
  });

  it('list item has no hold line for a log without time sets', async () => {
    const me = await seedProfile('Ana');
    await getRepository().importBackup({
      format: 'tytax-backup',
      version: 3,
      exportedAt: NOW.toISOString(),
      profiles: [],
      workoutLogs: [buildWorkoutLog(me.id, { daysAgo: 1, exercises: [{ exerciseId: 'bench', sets: [{ kg: 100, reps: 5 }] }] }, NOW, sequentialIds('k'))],
      programs: [],
      prRecords: [],
      bodyweightEntries: [],
      exerciseNotes: [],
      arsenal: [],
      equipment: [],
    });
    renderEn(<HistoryPage />);
    const item = await screen.findByTestId('history-item');
    expect(within(item).getByTestId('history-item-volume')).toBeInTheDocument();
    expect(within(item).queryByTestId('history-item-hold')).toBeNull();
  });
});
