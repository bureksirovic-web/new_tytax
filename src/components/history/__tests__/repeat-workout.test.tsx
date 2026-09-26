import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import type { WorkoutDraft, WorkoutLog } from '@/contracts/domain';
import HistoryDetailPage from '@/app/(app)/history/[id]/page-client';
import { useWorkoutStore } from '@/stores/workout-store';
import { resolveStartFromLog, repeatBlock } from '../start-from-log';
import { en, renderEn, resetDb, resolvedParams, router, seedLogs, seedProfile, seriousViolations } from './test-utils';

vi.mock('next/navigation', async () => (await import('./test-utils')).navigationMock);

const pristine = useWorkoutStore.getState();

beforeEach(async () => {
  await resetDb();
  window.localStorage.clear();
  useWorkoutStore.setState({ ...pristine, draft: null }, true);
});

/** Stand-in for G3's startFromLog (G4-25): refuses while a draft exists, else copies the log. */
function installStartFromLog(result: 'draft' | 'null' = 'draft') {
  const fn = vi.fn((profileId: string, log: WorkoutLog): WorkoutDraft | null => {
    if (result === 'null' || useWorkoutStore.getState().draft) return null;
    const draft: WorkoutDraft = { id: 'repeat-1', profileId, sessionName: log.sessionName, startedAt: '2026-09-17T08:00:00.000Z', exercises: log.exercises };
    useWorkoutStore.setState({ draft });
    return draft;
  });
  useWorkoutStore.setState({ startFromLog: fn } as never);
  return fn;
}

const draftOf = (profileId: string): WorkoutDraft => ({ id: 'open-1', profileId, sessionName: 'Open', startedAt: '2026-09-16T08:00:00.000Z', exercises: [] });

async function seedOne() {
  const me = await seedProfile('Ana');
  const [log] = await seedLogs(me.id, [
    { daysAgo: 1, sessionName: 'Push A', exercises: [{ exerciseId: 'bench', exerciseName: 'Bench', sets: [{ kg: 100, reps: 5 }] }] },
  ]);
  return { me, log };
}

async function openDetail(id: string) {
  const view = renderEn(<HistoryDetailPage params={resolvedParams(id)} />);
  await screen.findByTestId('page-heading-history-detail');
  return view;
}

async function clickRepeat() {
  const button = screen.getByTestId('history-repeat');
  await waitFor(() => expect(button).toBeEnabled());
  fireEvent.click(button);
}

describe('History: Repeat workout', () => {
  it('is hidden while the workout store has no startFromLog', async () => {
    const { log } = await seedOne();
    await openDetail(log.id);
    expect(screen.getByTestId('history-edit')).toBeInTheDocument();
    expect(screen.queryByTestId('history-repeat')).toBeNull();
  });

  it('starts a draft from the log and opens the active workout', async () => {
    const start = installStartFromLog();
    const { me, log } = await seedOne();
    const { container } = await openDetail(log.id);
    expect(screen.getByTestId('history-repeat')).toHaveTextContent(en('hist_repeat'));
    expect(await seriousViolations(container)).toEqual([]);
    await clickRepeat();
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/workout/active'));
    expect(start).toHaveBeenCalledTimes(1);
    expect(start.mock.calls[0][0]).toBe(me.id);
    expect(start.mock.calls[0][1].id).toBe(log.id);
    expect(useWorkoutStore.getState().draft?.sessionName).toBe('Push A');
  });

  it('with this profile\'s draft open, offers continue or replace', async () => {
    const start = installStartFromLog();
    const { me, log } = await seedOne();
    useWorkoutStore.setState({ draft: draftOf(me.id) });
    await openDetail(log.id);
    await clickRepeat();
    let dialog = await screen.findByRole('dialog', { name: en('hist_repeat_draft_title') });
    expect(dialog).toHaveTextContent(en('hist_repeat_draft_msg'));
    fireEvent.click(within(dialog).getByTestId('history-repeat-continue'));
    expect(router.push).toHaveBeenCalledWith('/workout/active');
    expect(start).not.toHaveBeenCalled();
    expect(useWorkoutStore.getState().draft?.id).toBe('open-1');

    router.push.mockClear();
    fireEvent.click(screen.getByTestId('history-repeat'));
    dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByTestId('history-repeat-replace'));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/workout/active'));
    expect(start).toHaveBeenCalledTimes(1);
    expect(useWorkoutStore.getState().draft?.id).toBe('repeat-1');
  });

  it('never replaces another profile\'s draft', async () => {
    const start = installStartFromLog();
    const { log } = await seedOne();
    useWorkoutStore.setState({ draft: draftOf('someone-else') });
    await openDetail(log.id);
    await clickRepeat();
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent(en('hist_repeat_foreign'));
    expect(within(dialog).queryByTestId('history-repeat-replace')).toBeNull();
    expect(within(dialog).queryByTestId('history-repeat-continue')).toBeNull();
    fireEvent.click(within(dialog).getByRole('button', { name: en('hist_edit_cancel') }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(start).not.toHaveBeenCalled();
    expect(useWorkoutStore.getState().draft?.id).toBe('open-1');
  });

  it('announces a refused start and stays on the page', async () => {
    installStartFromLog('null');
    const { log } = await seedOne();
    await openDetail(log.id);
    await clickRepeat();
    expect(await screen.findByRole('alert')).toHaveTextContent(en('hist_repeat_failed'));
    expect(router.push).not.toHaveBeenCalled();
  });
});

describe('start-from-log adapter', () => {
  it('detects the action only when it is a function', () => {
    const fn = () => null;
    expect(resolveStartFromLog({ startFromLog: fn })).toBe(fn);
    expect(resolveStartFromLog({ startFromLog: 'nope' })).toBeNull();
    expect(resolveStartFromLog({})).toBeNull();
    expect(resolveStartFromLog(null)).toBeNull();
  });

  it('classifies the blocking draft by profile', () => {
    expect(repeatBlock(null, 'p1')).toBe('none');
    expect(repeatBlock({ profileId: 'p1' }, 'p1')).toBe('own-draft');
    expect(repeatBlock({ profileId: 'p2' }, 'p1')).toBe('foreign-draft');
  });
});
