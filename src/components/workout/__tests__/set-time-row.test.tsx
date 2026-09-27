import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import type { ExerciseMeasure, SetEntry } from '@/contracts/domain';
import type { SetPatch } from '@/stores/workout-store';
import { SetRow } from '../set-row';

const TIME_SET: SetEntry = { id: 't1', type: 'working', kg: 0, reps: 0, done: false };
const REPS_SET: SetEntry = { id: 'r1', type: 'working', kg: 100, reps: 5, done: false };

interface HarnessProps {
  initial: SetEntry;
  measure?: ExerciseMeasure;
  ghostSeconds?: number;
  onPatch?: (p: SetPatch) => void;
  onToggleDone?: () => void;
  now?: () => number;
}

/** Applies patches like the store would, so the row re-renders with the stored value. */
function Harness({ initial, measure, ghostSeconds, onPatch, onToggleDone = vi.fn(), now }: HarnessProps) {
  const [set, setSet] = useState(initial);
  return (
    <ul>
      <SetRow
        set={set}
        number={1}
        modality="tytax"
        units="kg"
        measure={measure}
        ghostSeconds={ghostSeconds}
        now={now}
        onChange={(p) => {
          onPatch?.(p);
          setSet((s) => ({ ...s, ...p }));
        }}
        onToggleDone={onToggleDone}
        onRemove={vi.fn()}
      />
    </ul>
  );
}

afterEach(() => {
  vi.useRealTimers();
  sessionStorage.clear();
});

describe('SetRow for a time exercise', () => {
  it('shows duration, hold timer and RIR instead of kg/reps/e1RM', () => {
    render(<Harness initial={TIME_SET} measure="time" />);
    expect(screen.getByTestId('set-duration')).toHaveAttribute('inputmode', 'numeric');
    expect(screen.getByTestId('set-duration')).toHaveAccessibleName('Set 1: Duration (seconds or m:ss)');
    expect(screen.getByTestId('set-hold-toggle')).toHaveAccessibleName('Set 1: Start hold timer');
    expect(screen.getByTestId('set-rir')).toHaveAccessibleName('Set 1: RIR, reps in reserve (0-5), optional');
    expect(screen.queryByTestId('set-kg')).toBeNull();
    expect(screen.queryByTestId('set-reps')).toBeNull();
    expect(screen.queryByTestId('set-e1rm')).toBeNull();
    expect(screen.queryByTestId('set-hold-elapsed')).toBeNull();
  });

  it('done is disabled until the duration is above 0, and RIR is not needed', () => {
    render(<Harness initial={TIME_SET} measure="time" />);
    const done = screen.getByTestId('set-done');
    expect(done).toBeDisabled();
    expect(done).toHaveAttribute('title', 'Enter a duration or time the hold first');
    fireEvent.change(screen.getByTestId('set-duration'), { target: { value: '45' } });
    expect(done).toBeEnabled();
    expect(screen.getByTestId('set-rir')).toHaveValue('');
  });

  it('accepts seconds or m:ss and shows m:ss on blur', () => {
    const onPatch = vi.fn();
    render(<Harness initial={TIME_SET} measure="time" onPatch={onPatch} />);
    const input = screen.getByTestId('set-duration');
    fireEvent.change(input, { target: { value: '1:30' } });
    expect(onPatch).toHaveBeenLastCalledWith({ durationSeconds: 90 });
    fireEvent.change(input, { target: { value: '75' } });
    expect(onPatch).toHaveBeenLastCalledWith({ durationSeconds: 75 });
    expect(input).toHaveValue('75'); // typed text kept while typing
    fireEvent.blur(input);
    expect(input).toHaveValue('1:15'); // 75 s = 1 min 15 s
  });

  it('ignores unparsable text and stores 0 when cleared', () => {
    const onPatch = vi.fn();
    render(<Harness initial={{ ...TIME_SET, durationSeconds: 30 }} measure="time" onPatch={onPatch} />);
    const input = screen.getByTestId('set-duration');
    expect(input).toHaveValue('0:30');
    fireEvent.change(input, { target: { value: '1:' } });
    expect(onPatch).not.toHaveBeenCalled();
    fireEvent.blur(input);
    expect(input).toHaveValue('0:30');
    fireEvent.change(input, { target: { value: '' } });
    expect(onPatch).toHaveBeenLastCalledWith({ durationSeconds: 0 });
    expect(screen.getByTestId('set-done')).toBeDisabled();
  });

  it('shows the ghost duration as the placeholder and in the name', () => {
    render(<Harness initial={TIME_SET} measure="time" ghostSeconds={45} />);
    const input = screen.getByTestId('set-duration');
    expect(input).toHaveAttribute('placeholder', '0:45');
    expect(input).toHaveAccessibleName('Set 1: Duration (seconds or m:ss). Last time 0:45');
  });

  it('without a ghost the placeholder names the unit', () => {
    render(<Harness initial={TIME_SET} measure="time" />);
    expect(screen.getByTestId('set-duration')).toHaveAttribute('placeholder', 'sec');
  });

  it('Enter in the duration completes a timed set, not an empty or done one', () => {
    const onToggleDone = vi.fn();
    render(<Harness initial={TIME_SET} measure="time" onToggleDone={onToggleDone} />);
    const input = screen.getByTestId('set-duration');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onToggleDone).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: '20' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onToggleDone).toHaveBeenCalledTimes(1);
  });

  it('the hold timer runs from a timestamp and stop writes durationSeconds', () => {
    vi.useFakeTimers();
    let clock = 1_000_000;
    const onPatch = vi.fn();
    render(<Harness initial={TIME_SET} measure="time" onPatch={onPatch} now={() => clock} />);
    const toggle = screen.getByTestId('set-hold-toggle');
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('set-hold-elapsed')).toHaveTextContent('0:00');
    // A throttled tab: the clock jumps 72.6 s but only one tick fires → 72 s = 1:12.
    clock += 72_600;
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(screen.getByTestId('set-hold-elapsed')).toHaveTextContent('1:12');
    expect(toggle).toHaveAccessibleName('Set 1: Stop hold timer at 1:12 and save it');
    fireEvent.click(toggle);
    expect(onPatch).toHaveBeenLastCalledWith({ durationSeconds: 72 });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByTestId('set-hold-elapsed')).toBeNull();
    expect(screen.getByTestId('set-duration')).toHaveValue('1:12');
    expect(screen.getByTestId('set-done')).toBeEnabled();
  });

  it('a running hold survives an unmount/reload and stopping it clears the stored start', () => {
    let clock = 2_000_000;
    const onPatch = vi.fn();
    const first = render(<Harness initial={TIME_SET} measure="time" onPatch={onPatch} now={() => clock} />);
    fireEvent.click(screen.getByTestId('set-hold-toggle'));
    expect(sessionStorage.getItem('tytax-hold:t1')).toBe('2000000');
    first.unmount();
    // Reload 95 s later: 95 s = 1:35, still running.
    clock += 95_000;
    render(<Harness initial={TIME_SET} measure="time" onPatch={onPatch} now={() => clock} />);
    const toggle = screen.getByTestId('set-hold-toggle');
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('set-hold-elapsed')).toHaveTextContent('1:35');
    fireEvent.click(toggle);
    expect(onPatch).toHaveBeenLastCalledWith({ durationSeconds: 95 });
    expect(sessionStorage.getItem('tytax-hold:t1')).toBeNull();
  });

  it('a hold stopped under 1 s keeps the entered duration', () => {
    let clock = 5_000;
    const onPatch = vi.fn();
    render(<Harness initial={{ ...TIME_SET, durationSeconds: 40 }} measure="time" onPatch={onPatch} now={() => clock} />);
    const toggle = screen.getByTestId('set-hold-toggle');
    fireEvent.click(toggle);
    clock += 600;
    fireEvent.click(toggle);
    expect(onPatch).not.toHaveBeenCalled();
    expect(screen.getByTestId('set-duration')).toHaveValue('0:40');
  });

  it('the hold toggle is keyboard operable', () => {
    let clock = 0;
    const onPatch = vi.fn();
    render(<Harness initial={TIME_SET} measure="time" onPatch={onPatch} now={() => clock} />);
    const toggle = screen.getByTestId('set-hold-toggle');
    expect(toggle.tagName).toBe('BUTTON');
    toggle.focus();
    expect(toggle).toHaveFocus();
    fireEvent.click(toggle);
    clock = 3_000;
    fireEvent.click(toggle);
    expect(onPatch).toHaveBeenLastCalledWith({ durationSeconds: 3 });
  });

  it('a done time set can always be undone', () => {
    render(<Harness initial={{ ...TIME_SET, done: true, durationSeconds: 0 }} measure="time" />);
    expect(screen.getByTestId('set-done')).toBeEnabled();
  });

  it('without a measure, a set carrying durationSeconds renders as a time set', () => {
    render(<Harness initial={{ ...TIME_SET, durationSeconds: 60 }} />);
    expect(screen.getByTestId('set-duration')).toHaveValue('1:00');
    expect(screen.queryByTestId('set-kg')).toBeNull();
  });
});

describe('SetRow for a reps exercise is unchanged', () => {
  it('keeps kg, reps, RIR and e1RM and the reps done rule', () => {
    render(<Harness initial={REPS_SET} measure="reps" />);
    expect(screen.getByTestId('set-kg')).toHaveValue('100');
    expect(screen.getByTestId('set-reps')).toHaveValue('5');
    expect(screen.getByTestId('set-rir')).toHaveAccessibleName('Set 1: RIR, reps in reserve (0-5)');
    // Brzycki: 100 × 36 / (37 − 5) = 112.5
    expect(screen.getByTestId('set-e1rm')).toHaveTextContent('112.5');
    expect(screen.queryByTestId('set-duration')).toBeNull();
    expect(screen.queryByTestId('set-hold-toggle')).toBeNull();
    expect(screen.getByTestId('set-done')).toBeEnabled();
  });

  it('an explicit reps measure wins over a stray durationSeconds', () => {
    render(<Harness initial={{ ...REPS_SET, durationSeconds: 30 }} measure="reps" />);
    expect(screen.getByTestId('set-kg')).toBeInTheDocument();
    expect(screen.queryByTestId('set-duration')).toBeNull();
  });
});
