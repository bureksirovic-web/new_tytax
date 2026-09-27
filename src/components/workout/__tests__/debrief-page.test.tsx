import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import type { WorkoutDebrief, WorkoutDraft } from '@/contracts/domain';
import { DEFAULT_PROFILE_SETTINGS } from '@/contracts/domain';
import type { FinishResult } from '@/contracts/repo';
import type { PRCandidate } from '@/contracts/training';

const router = { push: vi.fn(), replace: vi.fn(), back: vi.fn() };
vi.mock('next/navigation', () => ({ useRouter: () => router }));

const finish = vi.fn<(d?: WorkoutDebrief) => Promise<FinishResult>>();
const hook = vi.hoisted(() => ({ units: 'kg' as 'kg' | 'lb' }));
vi.mock('@/hooks/use-workout', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/hooks/use-workout')>();
  return { ...actual, useWorkout: () => ({
      ready: true, foreignDraft: false, finish, settings: { ...DEFAULT_PROFILE_SETTINGS, units: hook.units },
    }) };
});

import { useWorkoutStore } from '@/stores/workout-store';
import DebriefPage from '@/app/(app)/workout/debrief/page-client';
import { durationMinutes } from '@/components/workout/debrief-summary';
import { parseRpe } from '@/components/workout/debrief-rpe-field';

const DRAFT: WorkoutDraft = {
  id: 'draft-9',
  profileId: 'p1',
  sessionName: 'Upper B',
  startedAt: new Date(Date.now() - 47 * 60_000 - 10_000).toISOString(),
  exercises: [
    {
      uid: 'u1', exerciseId: 'bench', exerciseName: 'Bench', modality: 'tytax',
      sets: [
        { id: 'w', type: 'warmup', kg: 60, reps: 10, done: true },
        { id: 'a', type: 'working', kg: 100, reps: 5, done: true },
        { id: 'b', type: 'drop', kg: 80, reps: 8, done: true },
        { id: 'c', type: 'working', kg: 100, reps: 5, done: false },
      ],
    },
    { uid: 'u2', exerciseId: 'row', exerciseName: 'Row', modality: 'tytax', sets: [] },
  ],
};

function pr(over: Partial<PRCandidate>): PRCandidate {
  return {
    exerciseId: 'bench', exerciseName: 'Bench', prType: 'weight', value: 100, kg: 100, reps: 5, setId: 'a',
    sessionExerciseUid: 'u1', previousBest: 97.5, isBaseline: false, ...over,
  };
}

function result(prs: PRCandidate[]): FinishResult {
  return { log: {} as FinishResult['log'], prs, alreadyFinished: false };
}

async function click(testId: string) {
  await act(async () => {
    fireEvent.click(screen.getByTestId(testId));
  });
}

describe('debrief page (G3 finish)', () => {
  beforeEach(() => {
    router.replace.mockReset();
    finish.mockReset();
    hook.units = 'kg';
    localStorage.clear();
    useWorkoutStore.setState({ draft: DRAFT });
  });

  it('summarises done working sets, exercises and duration', () => {
    render(<DebriefPage />);
    // Done non-warm-up sets: 100×5 + 80×8 = 500 + 640 = 1140 kg over 2 sets (locale number format, with the unit).
    expect(screen.getByTestId('debrief-volume')).toHaveTextContent('1,140 kg');
    expect(screen.getByTestId('debrief-sets')).toHaveTextContent('2');
    expect(screen.getByTestId('debrief-exercises')).toHaveTextContent('2');
    // Started 47 min 10 s ago → rounds to 47.
    expect(screen.getByTestId('debrief-duration')).toHaveTextContent('47 min');
    // No time sets → no hold stat.
    expect(screen.queryByTestId('debrief-hold')).toBeNull();
  });

  // Refuter R2 (2026-09-27): the volume was raw kg with no unit, whatever the profile's units.
  it('shows the volume in the profile\'s units (lb) with the locale number format', () => {
    hook.units = 'lb';
    render(<DebriefPage />);
    // 1140 kg × 2.20462 = 2513.27 lb → 2,513.3 lb (en).
    expect(screen.getByTestId('debrief-volume')).toHaveTextContent('2,513.3 lb');
    expect(screen.getByTestId('debrief-volume')).not.toHaveTextContent('kg');
    expect(screen.getByTestId('debrief-sets')).toHaveTextContent('2');
  });

  it('shows the seconds held (G1 holdSeconds) and keeps time sets out of kg volume', () => {
    const plank = {
      uid: 'plank', exerciseId: 'plank', exerciseName: 'Plank', modality: 'bodyweight' as const,
      sets: [
        { id: 'h1', type: 'working' as const, kg: 10, reps: 0, done: true, durationSeconds: 45 },
        { id: 'h2', type: 'working' as const, kg: 0, reps: 0, done: true, durationSeconds: 80 },
        { id: 'h3', type: 'working' as const, kg: 0, reps: 0, done: false, durationSeconds: 60 },
      ],
    };
    useWorkoutStore.setState({ draft: { ...DRAFT, exercises: [...DRAFT.exercises, plank] } });
    render(<DebriefPage />);
    // 45 + 80 = 125 s = 2:05 (the undone 60 s set does not count); the 10 kg on h1 is not volume.
    expect(screen.getByTestId('debrief-hold')).toHaveTextContent('2:05');
    expect(screen.getByTestId('debrief-volume')).toHaveTextContent('1,140 kg');
    // 2 rep sets + 2 done time sets.
    expect(screen.getByTestId('debrief-sets')).toHaveTextContent('4');
  });

  it('RPE quick buttons fill the input; none is selected by default; a second tap clears', async () => {
    render(<DebriefPage />);
    for (const n of [6, 7, 8, 9, 10]) expect(screen.getByTestId(`debrief-rpe-${n}`)).toHaveAttribute('aria-pressed', 'false');
    await click('debrief-rpe-9');
    expect(screen.getByTestId('debrief-rpe')).toHaveValue(9);
    expect(screen.getByTestId('debrief-rpe-9')).toHaveAttribute('aria-pressed', 'true');
    await click('debrief-rpe-9');
    expect(screen.getByTestId('debrief-rpe')).toHaveValue(null);
    fireEvent.change(screen.getByTestId('debrief-rpe'), { target: { value: '7' } });
    expect(screen.getByTestId('debrief-rpe-7')).toHaveAttribute('aria-pressed', 'true');
  });

  it('saves once on a double click, then goes to history without a PR', async () => {
    let resolve: (r: FinishResult) => void = () => {};
    finish.mockImplementation(() => new Promise((r) => (resolve = r)));
    render(<DebriefPage />);
    await click('debrief-rpe-8');
    fireEvent.change(screen.getByTestId('debrief-notes'), { target: { value: ' good ' } });
    await click('save-workout');
    await click('save-workout');
    expect(finish).toHaveBeenCalledTimes(1);
    expect(finish).toHaveBeenCalledWith({ rpe: 8, notes: 'good' });
    expect(screen.getByTestId('save-workout')).toBeDisabled();
    // Nothing is discarded before the log is saved.
    expect(useWorkoutStore.getState().draft).toEqual(DRAFT);

    await act(async () => resolve(result([pr({ isBaseline: true, previousBest: null })])));
    expect(useWorkoutStore.getState().draft).toBeNull();
    expect(router.replace).toHaveBeenCalledWith('/history');
    expect(router.replace).not.toHaveBeenCalledWith('/workout');
    expect(screen.queryByTestId('pr-celebration')).toBeNull();
  });

  it('celebrates non-baseline PRs only, then continues to history', async () => {
    finish.mockResolvedValue(
      result([
        pr({ prType: 'e1rm', value: 116.66, previousBest: 112.5 }),
        pr({ exerciseId: 'row', exerciseName: 'Row', prType: 'weight', value: 70, previousBest: null, isBaseline: true }),
        pr({ prType: 'weight', value: 100, previousBest: 97.5 }),
      ]),
    );
    render(<DebriefPage />);
    await click('save-workout');
    expect(useWorkoutStore.getState().draft).toBeNull();
    expect(router.replace).not.toHaveBeenCalled();
    const items = screen.getAllByTestId('pr-celebration-item');
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveAttribute('data-pr-type', 'e1rm');
    expect(within(items[0]).getByTestId('pr-celebration-value')).toHaveTextContent('116.7 kg');
    expect(within(items[0]).getByTestId('pr-celebration-previous')).toHaveTextContent('was 112.5 kg');
    expect(items[1]).toHaveTextContent('Bench');
    expect(items[1]).toHaveTextContent('Heaviest weight');
    await click('pr-celebration-continue');
    expect(router.replace).toHaveBeenCalledWith('/history');
    expect(router.replace).not.toHaveBeenCalledWith('/workout');
  });

  it('shows PR values in pounds and reps as counts', async () => {
    hook.units = 'lb';
    finish.mockResolvedValue(result([pr({ value: 100, previousBest: 90 }), pr({ prType: 'reps', value: 12, previousBest: 10 })]));
    render(<DebriefPage />);
    await click('save-workout');
    const items = screen.getAllByTestId('pr-celebration-item');
    // 100 kg × 2.20462 = 220.462 → 220.5 lb; 90 kg → 198.4 lb.
    expect(items[0]).toHaveTextContent('220.5 lb');
    expect(items[0]).toHaveTextContent('was 198.4 lb');
    expect(items[1]).toHaveTextContent('12 reps');
    expect(items[1]).toHaveTextContent('was 10 reps');
  });

  it('keeps the draft and re-enables save when finishing fails', async () => {
    finish.mockRejectedValue(new Error('quota'));
    render(<DebriefPage />);
    await click('save-workout');
    expect(screen.getByTestId('debrief-error')).toBeInTheDocument();
    expect(useWorkoutStore.getState().draft).toEqual(DRAFT);
    expect(screen.getByTestId('save-workout')).not.toBeDisabled();
    expect(router.replace).not.toHaveBeenCalled();
  });
});

describe('debrief helpers', () => {
  it('durationMinutes rounds and never goes negative', () => {
    const start = '2026-09-26T10:00:00.000Z';
    expect(durationMinutes(start, Date.parse(start) + 90 * 60_000 + 29_000)).toBe(90);
    expect(durationMinutes(start, Date.parse(start) - 60_000)).toBe(0);
    expect(durationMinutes('nope', Date.now())).toBe(0);
  });

  it('parseRpe clamps to 1–10 and rejects blanks', () => {
    expect(parseRpe('')).toBeUndefined();
    expect(parseRpe('abc')).toBeUndefined();
    expect(parseRpe('7,6')).toBe(8);
    expect(parseRpe('14')).toBe(10);
    expect(parseRpe('0')).toBe(1);
  });
});
