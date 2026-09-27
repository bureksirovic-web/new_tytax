import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { getRepository } from '@/lib/db';
import HistoryEditPage from '@/app/(app)/history/[id]/edit/page-client';
import { en, renderEn, resetDb, resolvedParams, router, seedLogs, seedProfile, seriousViolations } from './test-utils';

vi.mock('next/navigation', async () => (await import('./test-utils')).navigationMock);

beforeEach(resetDb);

const renderEdit = (id: string) => renderEn(<HistoryEditPage params={resolvedParams(id)} />);

async function seedOne(units: 'kg' | 'lb' = 'kg') {
  const me = await seedProfile('Ana', units);
  const [log] = await seedLogs(me.id, [
    {
      daysAgo: 1,
      notes: 'old note',
      exercises: [
        { exerciseId: 'bench', exerciseName: 'Bench', sets: [{ kg: 100, reps: 5 }, { kg: 100, reps: 5 }] },
        { exerciseId: 'row', exerciseName: 'Row', sets: [{ kg: 50, reps: 10 }] },
      ],
    },
  ]);
  return { me, log };
}

const weightInputs = () => screen.getAllByLabelText(/^Weight/);

describe('History editor', () => {
  it('edits kg/reps/done, adds and removes sets; the repo recomputes totals', async () => {
    const { me, log } = await seedOne();
    renderEdit(log.id);
    await screen.findByTestId('page-heading-history-edit');
    const [bench] = screen.getAllByTestId('history-edit-exercise');
    fireEvent.change(weightInputs()[0], { target: { value: '110' } });
    fireEvent.click(within(bench).getAllByLabelText(en('hist_edit_done'))[1]); // set 2 → not done
    fireEvent.click(within(bench).getByTestId('history-edit-add-set')); // copies 100×5, done
    fireEvent.change(screen.getByLabelText(en('hist_edit_notes')), { target: { value: 'new note' } });
    fireEvent.click(screen.getByTestId('history-edit-save'));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith(`/history/${log.id}`));
    const saved = await getRepository().logs.get(me.id, log.id);
    // bench 110×5 + (undone 100×5) + added 100×5; row 50×10 → 550 + 500 + 500 = 1 550 kg, 3 sets
    expect(saved?.totalVolumeKg).toBe(1550);
    expect(saved?.totalSets).toBe(3);
    expect(saved?.exercises[0].sets).toHaveLength(3);
    expect(saved?.notes).toBe('new note');
  });

  it('enters lb and stores kg', async () => {
    const { me, log } = await seedOne('lb');
    renderEdit(log.id);
    await screen.findByTestId('page-heading-history-edit');
    // 100 kg → 220.5 lb shown
    expect(weightInputs()[0]).toHaveValue('220.5');
    fireEvent.change(weightInputs()[2], { target: { value: '225' } });
    fireEvent.click(screen.getByTestId('history-edit-save'));
    await waitFor(() => expect(router.push).toHaveBeenCalled());
    const saved = await getRepository().logs.get(me.id, log.id);
    // 225 lb / 2.20462 = 102.06 kg; bench sets unchanged stay exactly 100 kg
    expect(saved?.exercises[1].sets[0].kg).toBe(102.06);
    expect(saved?.exercises[0].sets[0].kg).toBe(100);
  });

  it('removes a set and an exercise (after confirm)', async () => {
    const { me, log } = await seedOne();
    renderEdit(log.id);
    await screen.findByTestId('page-heading-history-edit');
    fireEvent.click(screen.getAllByRole('button', { name: en('hist_edit_remove_set', { n: 2 }) })[0]);
    fireEvent.click(screen.getAllByRole('button', { name: en('hist_edit_remove_exercise') })[1]);
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: en('hist_edit_remove_exercise') }));
    fireEvent.click(screen.getByTestId('history-edit-save'));
    await waitFor(() => expect(router.push).toHaveBeenCalled());
    const saved = await getRepository().logs.get(me.id, log.id);
    expect(saved?.exercises.map((e) => e.exerciseId)).toEqual(['bench']);
    expect(saved?.totalVolumeKg).toBe(500);
  });

  it('blocks saving invalid values', async () => {
    const { me, log } = await seedOne();
    renderEdit(log.id);
    await screen.findByTestId('page-heading-history-edit');
    fireEvent.change(weightInputs()[0], { target: { value: '-5' } });
    expect(screen.getByTestId('history-edit-save')).toBeDisabled();
    expect(screen.getAllByText(en('hist_edit_invalid')).length).toBeGreaterThan(0);
    expect(weightInputs()[0]).toHaveAttribute('aria-invalid', 'true');
    expect((await getRepository().logs.get(me.id, log.id))?.totalVolumeKg).toBe(1500);
  });

  it('asks before discarding changes', async () => {
    const { log } = await seedOne();
    renderEdit(log.id);
    await screen.findByTestId('page-heading-history-edit');
    fireEvent.click(screen.getByRole('button', { name: en('hist_edit_cancel') }));
    expect(router.push).toHaveBeenCalledWith(`/history/${log.id}`); // clean → no dialog
    router.push.mockClear();
    fireEvent.change(weightInputs()[0], { target: { value: '90' } });
    fireEvent.click(screen.getByRole('button', { name: en('hist_edit_cancel') }));
    const dialog = await screen.findByRole('dialog');
    expect(router.push).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole('button', { name: en('hist_edit_discard') }));
    expect(router.push).toHaveBeenCalledWith(`/history/${log.id}`);
  });

  it('youth mode (profile under 16): the set-type picker offers no drop/failure option', async () => {
    const { me, log } = await seedOne();
    await getRepository().profiles.update(me.id, { birthYear: 2015 }); // 11 in 2026
    renderEdit(log.id);
    await screen.findByTestId('page-heading-history-edit');
    const select = screen.getAllByTestId('history-edit-set-type')[0];
    const values = within(select).getAllByRole('option').map((o) => (o as HTMLOptionElement).value);
    expect(values).toEqual(['working', 'warmup']);
  });

  it('adult profile: the set-type picker offers drop and failure', async () => {
    const { log } = await seedOne();
    renderEdit(log.id);
    await screen.findByTestId('page-heading-history-edit');
    const select = screen.getAllByTestId('history-edit-set-type')[0];
    const values = within(select).getAllByRole('option').map((o) => (o as HTMLOptionElement).value);
    expect(values).toEqual(['working', 'warmup', 'drop', 'failure']);
  });

  it('shows not-found for an unknown id and has no serious axe violations', async () => {
    const { log } = await seedOne();
    const { container, unmount } = renderEdit(log.id);
    await screen.findByTestId('history-editor');
    expect(await seriousViolations(container)).toEqual([]);
    unmount();
    renderEdit('missing');
    expect(await screen.findByTestId('history-not-found')).toBeInTheDocument();
  });
});
