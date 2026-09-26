import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import type { Exercise, Profile, SetEntry, WorkoutDraft } from '@/contracts/domain';
import { DEFAULT_PROFILE_SETTINGS } from '@/contracts/domain';
import type { UseWorkoutResult } from '@/hooks/use-workout';

const router = { push: vi.fn(), replace: vi.fn(), back: vi.fn() };
vi.mock('next/navigation', () => ({ useRouter: () => router }));
vi.mock('@/lib/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/db')>();
  return { ...actual, getRepository: () => ({ watch: () => () => undefined }) };
});
vi.mock('@/lib/catalog', () => ({ catalog: { search: async () => [] }, loadCatalog: () => new Promise(() => undefined) }));

const hook = vi.hoisted(() => ({ current: undefined as unknown }));
vi.mock('@/hooks/use-workout', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/hooks/use-workout')>();
  return { ...actual, useWorkout: () => hook.current };
});

import { useWorkoutStore } from '@/stores/workout-store';
import WorkoutPage from '@/app/(app)/workout/page-client';
import ActiveWorkoutPage from '@/app/(app)/workout/active/page-client';
import DebriefPage from '@/app/(app)/workout/debrief/page-client';
import { AddToWorkoutButton } from '../add-to-workout-button';
import { NumberField } from '../number-field';
import { SetRow } from '../set-row';
import { canCompleteSet, repsOnDone } from '../set-rules';
import { DebriefRpeField } from '../debrief-rpe-field';
import { displayToKg, kgToDisplay } from '@/lib/utils';

const OWNER: Profile = { id: 'pA', name: 'Ana', activeProgramId: null, settings: DEFAULT_PROFILE_SETTINGS, createdAt: '', updatedAt: '' };
const SETS: SetEntry[] = [{ id: 's1', type: 'working', kg: 100, reps: 5, done: true }];
const DRAFT: WorkoutDraft = {
  id: 'd1', profileId: 'pA', sessionName: 'Leg day', startedAt: '2026-09-26T10:00:00.000Z',
  exercises: [{ uid: 'u1', exerciseId: 'bench', exerciseName: 'Bench', modality: 'tytax', sets: SETS }],
};
const bench = { id: 'bench', name: 'Bench', modality: 'tytax', impact: [] } as unknown as Exercise;

function makeHook(over: Partial<UseWorkoutResult> = {}): UseWorkoutResult {
  return {
    ready: true, profile: undefined, profileId: 'pB', settings: DEFAULT_PROFILE_SETTINGS, draft: null,
    activeProgram: undefined, activeProgramLoading: false, nextSession: null,
    startQuick: vi.fn(() => null), prepareProgramStart: vi.fn(async () => null), startProgram: vi.fn(async () => null),
    addExercise: vi.fn(async () => 'u1'), swapExercise: vi.fn(async () => 'u1'), finish: vi.fn(),
    skipRestDay: vi.fn(async () => null), foreignDraft: false, draftOwner: undefined,
    switchToDraftOwner: vi.fn(async () => undefined),
    orderByStation: vi.fn(async () => false), repeatLog: vi.fn(() => null), measureOfExercise: vi.fn(() => 'reps' as const),
    lastDurations: vi.fn(async (): Promise<Array<number | undefined>> => []),
    setup: { canSave: false, load: vi.fn(async () => undefined), save: vi.fn(async () => ({ saved: false as const, reason: 'unsupported' as const })) },
    ...over,
  };
}

const foreign = (over: Partial<UseWorkoutResult> = {}) =>
  makeHook({ draft: DRAFT, foreignDraft: true, draftOwner: OWNER, ...over });

async function click(testId: string) {
  await act(async () => {
    fireEvent.click(screen.getByTestId(testId));
  });
}

beforeEach(() => {
  router.push.mockReset();
  router.replace.mockReset();
  useWorkoutStore.setState({ draft: null });
});

describe('R03: NumberField accepts a decimal comma', () => {
  function Harness() {
    const [value, setValue] = useState<number | undefined>(0);
    return (
      <>
        <NumberField value={value} onValueChange={setValue} label="kg" testId="f" inputMode="decimal" step={0.25} zeroIsEmpty />
        <output data-testid="stored">{String(value)}</output>
      </>
    );
  }

  it('stores 62,5 as 62.5 kg in a text input that keeps the comma', () => {
    render(<Harness />);
    const input = screen.getByTestId('f');
    expect(input).toHaveAttribute('type', 'text');
    expect(input).toHaveAttribute('inputmode', 'decimal');
    fireEvent.change(input, { target: { value: '62,5' } });
    expect(screen.getByTestId('stored')).toHaveTextContent('62.5');
    expect(input).toHaveValue('62,5');
  });

  it('keeps the last good value for unparsable text and shows it again on blur', () => {
    render(<Harness />);
    const input = screen.getByTestId('f');
    fireEvent.change(input, { target: { value: '70' } });
    fireEvent.change(input, { target: { value: '70,5,' } });
    expect(screen.getByTestId('stored')).toHaveTextContent('70');
    fireEvent.blur(input);
    expect(input).toHaveValue('70');
  });
});

describe('R03: lb entry survives the 0.1 lb display rounding', () => {
  function LbHarness() {
    const [kg, setKg] = useState(0);
    return (
      <NumberField value={kg > 0 ? kgToDisplay(kg, 'lb') : kg} onValueChange={(v) => setKg(v === undefined ? 0 : displayToKg(v, 'lb'))}
        label="lb" testId="f" inputMode="decimal" step={0.25} zeroIsEmpty matchTolerance={0.05} />
    );
  }

  it.each(['21,25', '1.25', '137,75', '102.25'])('keeps "%s" as typed', (typed) => {
    render(<LbHarness />);
    const input = screen.getByTestId('f');
    fireEvent.change(input, { target: { value: typed.slice(0, -1) } });
    fireEvent.change(input, { target: { value: typed } });
    expect(input).toHaveValue(typed);
  });

  it('keeps every quarter-pound entry up to 500 lb (none rewritten mid-edit)', () => {
    render(<LbHarness />);
    const input = screen.getByTestId('f');
    const rewritten: string[] = [];
    for (let q = 1; q <= 2000; q++) {
      const typed = String(q / 4);
      fireEvent.change(input, { target: { value: typed } });
      if ((input as HTMLInputElement).value !== typed) rewritten.push(typed);
    }
    expect(rewritten).toEqual([]);
    expect(input).toHaveValue('500');
  });
});

describe('S3-01: done over ghost reps', () => {
  const ghost: SetEntry = { id: 'g', type: 'working', kg: 60, reps: 0, ghostReps: 8, done: false };

  it('counts ghost reps as the reps a done tap records', () => {
    expect(repsOnDone(ghost)).toBe(8);
    expect(canCompleteSet(ghost, 'tytax')).toBe(true);
    expect(canCompleteSet({ ...ghost, ghostReps: undefined }, 'tytax')).toBe(false);
    expect(canCompleteSet({ ...ghost, ghostReps: 0 }, 'tytax')).toBe(false);
  });

  it('enables the done button with ghost reps and disables it with neither', () => {
    const onToggle = vi.fn();
    const { rerender } = render(
      <SetRow set={ghost} number={1} modality="tytax" units="kg" onChange={vi.fn()} onToggleDone={onToggle} onRemove={vi.fn()} />,
    );
    fireEvent.click(screen.getByTestId('set-done'));
    expect(onToggle).toHaveBeenCalledTimes(1);
    rerender(
      <SetRow set={{ ...ghost, ghostReps: undefined }} number={1} modality="tytax" units="kg" onChange={vi.fn()} onToggleDone={onToggle} onRemove={vi.fn()} />,
    );
    expect(screen.getByTestId('set-done')).toBeDisabled();
  });
});

describe('R04: a draft of another profile', () => {
  it('/workout names the owner, switches back, and discards only after a confirm', async () => {
    const h = foreign();
    hook.current = h;
    useWorkoutStore.setState({ draft: DRAFT });
    render(<WorkoutPage />);
    expect(screen.getByTestId('foreign-draft-title')).toHaveTextContent('Workout in progress for Ana');
    expect(screen.queryByTestId('continue-workout')).toBeNull();
    expect(screen.queryByTestId('start-quick-workout')).toBeNull();
    await click('foreign-draft-switch');
    expect(h.switchToDraftOwner).toHaveBeenCalledTimes(1);
    await click('discard-workout');
    expect(useWorkoutStore.getState().draft).not.toBeNull();
    await click('discard-confirm');
    expect(useWorkoutStore.getState().draft).toBeNull();
  });

  it('offers only discard when the owner profile was deleted', () => {
    hook.current = foreign({ draftOwner: null });
    render(<WorkoutPage />);
    expect(screen.getByTestId('foreign-draft-title')).toHaveTextContent('another profile');
    expect(screen.queryByTestId('foreign-draft-switch')).toBeNull();
    expect(screen.getByTestId('discard-workout')).toBeInTheDocument();
  });

  it('offers no switch-back while the owner is still loading', () => {
    hook.current = foreign({ draftOwner: undefined });
    render(<WorkoutPage />);
    expect(screen.getByTestId('foreign-draft-title')).toHaveTextContent('another profile');
    expect(screen.queryByTestId('foreign-draft-switch')).toBeNull();
    expect(screen.getByTestId('foreign-draft')).not.toHaveTextContent('no longer exists');
  });

  it('tells the user when switching back fails', async () => {
    const h = foreign({ switchToDraftOwner: vi.fn(async () => Promise.reject(new Error('Profile not found'))) });
    hook.current = h;
    render(<WorkoutPage />);
    expect(screen.queryByTestId('foreign-draft-switch-error')).toBeNull();
    await click('foreign-draft-switch');
    expect(h.switchToDraftOwner).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('foreign-draft-switch-error')).toHaveTextContent('Could not switch');
  });

  it('the active page shows the foreign screen instead of the editable workout', async () => {
    hook.current = foreign();
    useWorkoutStore.setState({ draft: DRAFT });
    render(<ActiveWorkoutPage />);
    await act(async () => {});
    expect(screen.getByTestId('foreign-draft-screen')).toBeInTheDocument();
    expect(screen.queryByTestId('active-workout')).toBeNull();
    expect(screen.queryByTestId('finish-workout')).toBeNull();
  });

  it('the debrief refuses to save it', async () => {
    const h = foreign();
    hook.current = h;
    useWorkoutStore.setState({ draft: DRAFT });
    render(<DebriefPage />);
    await act(async () => {});
    expect(screen.getByTestId('foreign-draft-screen')).toBeInTheDocument();
    expect(screen.queryByTestId('save-workout')).toBeNull();
    expect(h.finish).not.toHaveBeenCalled();
  });

  it('add-to-workout never adds to it and opens /workout', async () => {
    const h = foreign();
    hook.current = h;
    useWorkoutStore.setState({ draft: DRAFT });
    render(<AddToWorkoutButton exercise={bench} />);
    await click('add-to-workout');
    expect(h.addExercise).not.toHaveBeenCalled();
    expect(useWorkoutStore.getState().draft?.exercises).toHaveLength(1);
    expect(router.push).toHaveBeenCalledWith('/workout');
  });
});

describe('S3-00 / S3-02: empty workouts and discarding', () => {
  it('the debrief offers discard (confirmed) instead of save with zero done sets', async () => {
    const empty: WorkoutDraft = { ...DRAFT, profileId: 'pB', exercises: [{ ...DRAFT.exercises[0], sets: [{ ...SETS[0], done: false }] }] };
    const h = makeHook({ draft: empty });
    hook.current = h;
    useWorkoutStore.setState({ draft: empty });
    render(<DebriefPage />);
    await act(async () => {});
    expect(screen.getByTestId('debrief-empty')).toHaveTextContent('No sets done');
    expect(screen.queryByTestId('save-workout')).toBeNull();
    await click('discard-workout');
    await click('discard-confirm');
    expect(useWorkoutStore.getState().draft).toBeNull();
    expect(h.finish).not.toHaveBeenCalled();
  });

  it('the active page has a confirmed discard', async () => {
    const own = { ...DRAFT, profileId: 'pB' };
    hook.current = makeHook({ draft: own });
    useWorkoutStore.setState({ draft: own });
    render(<ActiveWorkoutPage />);
    await act(async () => {});
    await click('discard-workout');
    expect(screen.getByTestId('discard-confirm-dialog')).toBeInTheDocument();
    await click('discard-cancel');
    expect(useWorkoutStore.getState().draft).not.toBeNull();
    await click('discard-workout');
    await click('discard-confirm');
    expect(useWorkoutStore.getState().draft).toBeNull();
  });
});

describe('S3-04: /workout while the active program loads', () => {
  it('shows a skeleton, not "no program"', () => {
    hook.current = makeHook({ activeProgramLoading: true });
    const { rerender } = render(<WorkoutPage />);
    expect(screen.getByTestId('active-program-loading')).toHaveAttribute('aria-busy', 'true');
    expect(screen.queryByText(/no program|nema programa/i)).toBeNull();
    hook.current = makeHook({ activeProgramLoading: false });
    rerender(<WorkoutPage />);
    expect(screen.queryByTestId('active-program-loading')).toBeNull();
  });
});

describe('S3-03: RIR and RPE inputs have their own accessible names', () => {
  it('names the RIR input RIR (not reps) and the debrief input Session RPE', () => {
    const set: SetEntry = { id: 'x', type: 'working', kg: 60, reps: 8, done: false };
    render(<SetRow set={set} number={1} modality="tytax" units="kg" onChange={vi.fn()} onToggleDone={vi.fn()} onRemove={vi.fn()} />);
    expect(screen.getByTestId('set-rir')).toHaveAccessibleName('Set 1: RIR, reps in reserve (0-5)');
    expect(screen.getByTestId('set-reps')).toHaveAccessibleName('Set 1: Reps');
    render(<DebriefRpeField value="" onChange={vi.fn()} />);
    expect(screen.getByLabelText('Session RPE (1–10)')).toBeInTheDocument();
  });
});
