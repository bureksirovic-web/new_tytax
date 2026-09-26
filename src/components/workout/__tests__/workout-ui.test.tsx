import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import type { Exercise } from '@/contracts/domain';

const search = vi.fn<(q: { text?: string; limit?: number }) => Promise<Exercise[]>>();
vi.mock('@/lib/catalog', () => ({ catalog: { search: (q: { text?: string; limit?: number }) => search(q) } }));

import { useWorkoutStore } from '@/stores/workout-store';
import { NumberField } from '../number-field';
import { SessionExerciseCard } from '../session-exercise-card';
import { ExercisePicker } from '../exercise-picker';

function makeExercise(id: string, name: string): Exercise {
  return {
    id,
    name,
    modality: 'tytax',
    muscleGroup: 'CHEST',
    pattern: 'push',
    isUnilateral: false,
    defaultSets: 2,
    defaultReps: '8-12',
    impact: [],
  };
}

function Harness({ initial, zeroIsEmpty, max }: { initial: number | undefined; zeroIsEmpty?: boolean; max?: number }) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <NumberField
        value={value}
        onValueChange={setValue}
        label="field"
        testId="field"
        inputMode="decimal"
        step={0.25}
        max={max}
        zeroIsEmpty={zeroIsEmpty}
      />
      <output data-testid="stored">{value === undefined ? 'undef' : String(value)}</output>
      <button type="button" onClick={() => setValue(42)}>
        external
      </button>
    </>
  );
}

describe('NumberField', () => {
  it('shows 0 as empty when asked and pushes typed values', () => {
    render(<Harness initial={0} zeroIsEmpty />);
    const input = screen.getByTestId('field');
    expect(input).toHaveValue(null);
    fireEvent.change(input, { target: { value: '62.5' } });
    expect(screen.getByTestId('stored')).toHaveTextContent('62.5');
    fireEvent.change(input, { target: { value: '' } });
    expect(screen.getByTestId('stored')).toHaveTextContent('undef');
  });

  it('clamps to max and resyncs on external changes', () => {
    render(<Harness initial={undefined} max={5} />);
    const input = screen.getByTestId('field');
    fireEvent.change(input, { target: { value: '7' } });
    // 7 is above max 5 → stored 5, field shows 5.
    expect(screen.getByTestId('stored')).toHaveTextContent('5');
    expect(input).toHaveValue(5);
    fireEvent.click(screen.getByText('external'));
    expect(input).toHaveValue(42);
  });
});

describe('SessionExerciseCard', () => {
  beforeEach(() => {
    localStorage.clear();
    useWorkoutStore.getState().startQuick('p1', 'Quick');
    useWorkoutStore.getState().addExercise(makeExercise('bench', 'Bench'));
  });

  function Card() {
    const ex = useWorkoutStore((s) => s.draft?.exercises[0]);
    return ex ? <SessionExerciseCard exercise={ex} isFirst isLast /> : null;
  }

  it('binds set inputs, done toggle, add and remove to the store', () => {
    render(<Card />);
    const card = screen.getByTestId('session-exercise');
    expect(card).toHaveAttribute('data-exercise-id', 'bench');
    // defaultSets 2 → min(2, 3) = 2 rows.
    expect(within(card).getAllByTestId('set-row')).toHaveLength(2);

    fireEvent.change(within(card).getAllByTestId('set-kg')[0], { target: { value: '80' } });
    fireEvent.change(within(card).getAllByTestId('set-reps')[0], { target: { value: '6' } });
    fireEvent.change(within(card).getAllByTestId('set-rir')[0], { target: { value: '2' } });
    const first = () => useWorkoutStore.getState().draft?.exercises[0].sets[0];
    expect(first()).toMatchObject({ kg: 80, reps: 6, rir: 2 });

    const done = within(card).getAllByTestId('set-done')[0];
    expect(done).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(done);
    expect(within(card).getAllByTestId('set-done')[0]).toHaveAttribute('aria-pressed', 'true');
    expect(first()?.done).toBe(true);

    fireEvent.click(within(card).getByTestId('add-set'));
    const rows = within(card).getAllByTestId('set-row');
    // 2 rows + 1 added = 3.
    expect(rows).toHaveLength(3);
    // The new row copies the last set's kg (0 here) → field stays empty.
    expect(within(rows[2]).getByTestId('set-kg')).toHaveValue(null);

    fireEvent.click(within(rows[0]).getByTestId('remove-set'));
    // 3 − 1 = 2 rows left.
    expect(within(card).getAllByTestId('set-row')).toHaveLength(2);
  });
});

describe('ExercisePicker', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    search.mockReset();
    search.mockImplementation(async (q) =>
      q.text ? [makeExercise('squat', 'Squat')] : [makeExercise('bench', 'Bench'), makeExercise('row', 'Row')],
    );
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('debounces search, lists results and picks one', async () => {
    const onPick = vi.fn();
    const onClose = vi.fn();
    render(<ExercisePicker onPick={onPick} onClose={onClose} />);
    expect(screen.getByTestId('exercise-picker')).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(150);
    });
    expect(search).toHaveBeenLastCalledWith({ text: '', limit: 30 });
    expect(screen.getAllByTestId('exercise-option')).toHaveLength(2);

    fireEvent.change(screen.getByTestId('exercise-search'), { target: { value: 'sq' } });
    expect(screen.queryAllByTestId('exercise-option')).toHaveLength(0);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(149);
    });
    // Only the initial query ran so far: the typed one waits the full 150 ms.
    expect(search).toHaveBeenCalledTimes(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(search).toHaveBeenLastCalledWith({ text: 'sq', limit: 30 });

    const option = screen.getByTestId('exercise-option');
    expect(option).toHaveAttribute('data-exercise-id', 'squat');
    fireEvent.click(option);
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ id: 'squat' }));

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
