/**
 * Hardening round 2 (DSH refuter on Wave 2 at dc5b5d1): finding 1 (ghost is a
 * placeholder, not the value) and finding 2 (a running hold revives from
 * sessionStorage and stop() overwrites a typed duration) at row level.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import type { SetEntry } from '@/contracts/domain';
import type { SetPatch } from '@/stores/workout-store';
import { SetRow } from '../set-row';
import { HOLD_MAX_REVIVE_MS } from '../hold-timer';

const TIME_SET: SetEntry = { id: 't1', type: 'working', kg: 0, reps: 0, done: false };

function Harness({ initial, ghostSeconds, onPatch, onToggleDone = vi.fn(), now }: {
  initial: SetEntry; ghostSeconds?: number; onPatch?: (p: SetPatch) => void; onToggleDone?: () => void; now?: () => number;
}) {
  const [set, setSet] = useState(initial);
  return (
    <ul>
      <SetRow
        set={set}
        number={1}
        modality="tytax"
        units="kg"
        measure="time"
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

afterEach(() => sessionStorage.clear());

describe('refuter F1 — ghost duration row', () => {
  it('an untouched row shows the ghost only as placeholder; Enter adopts it through the done action', () => {
    const onToggleDone = vi.fn();
    render(<Harness initial={{ ...TIME_SET, ghostDurationSeconds: 45 }} ghostSeconds={45} onToggleDone={onToggleDone} />);
    const input = screen.getByTestId('set-duration');
    expect(input).toHaveValue('');
    expect(input).toHaveAttribute('placeholder', '0:45');
    // Done is usable (it adopts the ghost, like ghost reps).
    expect(screen.getByTestId('set-done')).toBeEnabled();
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onToggleDone).toHaveBeenCalledTimes(1);
  });

  it('without a ghost, Enter on an empty duration does nothing and done stays disabled', () => {
    const onToggleDone = vi.fn();
    render(<Harness initial={TIME_SET} onToggleDone={onToggleDone} />);
    fireEvent.keyDown(screen.getByTestId('set-duration'), { key: 'Enter' });
    expect(onToggleDone).not.toHaveBeenCalled();
    expect(screen.getByTestId('set-done')).toBeDisabled();
  });
});

describe('refuter F2 — abandoned holds', () => {
  it('a stored hold older than the revive limit is discarded on mount', () => {
    const clock = 10_000_000_000;
    sessionStorage.setItem('tytax-hold:t1', String(clock - HOLD_MAX_REVIVE_MS - 1000));
    const onPatch = vi.fn();
    render(<Harness initial={TIME_SET} onPatch={onPatch} now={() => clock} />);
    const toggle = screen.getByTestId('set-hold-toggle');
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    expect(sessionStorage.getItem('tytax-hold:t1')).toBeNull();
    // A tap starts a fresh hold; it never writes the stale 30+ minutes.
    fireEvent.click(toggle);
    expect(onPatch).not.toHaveBeenCalled();
  });

  it('a stored hold for a set already done is discarded; the logged 30 s is kept', () => {
    const clock = 10_000_000_000;
    sessionStorage.setItem('tytax-hold:t1', String(clock - 120_000));
    const onPatch = vi.fn();
    render(<Harness initial={{ ...TIME_SET, done: true, durationSeconds: 30 }} onPatch={onPatch} now={() => clock} />);
    const toggle = screen.getByTestId('set-hold-toggle');
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    expect(sessionStorage.getItem('tytax-hold:t1')).toBeNull();
    expect(onPatch).not.toHaveBeenCalled();
    expect(screen.getByTestId('set-duration')).toHaveValue('0:30');
  });

  it('typing a duration while a hold runs cancels the hold; nothing overwrites the typed value', () => {
    let clock = 5_000_000;
    const onPatch = vi.fn();
    render(<Harness initial={TIME_SET} onPatch={onPatch} now={() => clock} />);
    const toggle = screen.getByTestId('set-hold-toggle');
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    clock += 120_000;
    fireEvent.change(screen.getByTestId('set-duration'), { target: { value: '30' } });
    expect(onPatch).toHaveBeenLastCalledWith({ durationSeconds: 30 });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    expect(sessionStorage.getItem('tytax-hold:t1')).toBeNull();
    // The next tap starts a new hold instead of writing 2:00 over the typed 30 s.
    fireEvent.click(toggle);
    expect(onPatch).toHaveBeenLastCalledWith({ durationSeconds: 30 });
    fireEvent.blur(screen.getByTestId('set-duration'));
    expect(screen.getByTestId('set-duration')).toHaveValue('0:30');
  });

  it('marking the set done while a hold runs cancels the hold', () => {
    const clock = 7_000_000;
    const onPatch = vi.fn();
    const row = (done: boolean) => (
      <ul>
        <SetRow set={{ ...TIME_SET, durationSeconds: 30, done }} number={1} modality="tytax" units="kg" measure="time" now={() => clock} onChange={onPatch} onToggleDone={vi.fn()} onRemove={vi.fn()} />
      </ul>
    );
    const { rerender } = render(row(false));
    fireEvent.click(screen.getByTestId('set-hold-toggle'));
    expect(sessionStorage.getItem('tytax-hold:t1')).toBe(String(clock));
    // Same row instance, the set becomes done (store toggle).
    rerender(row(true));
    expect(onPatch).not.toHaveBeenCalled();
    expect(screen.getByTestId('set-hold-toggle')).toHaveAttribute('aria-pressed', 'false');
    expect(sessionStorage.getItem('tytax-hold:t1')).toBeNull();
  });
  it('a hold left running past the revive limit (no reload) writes nothing on stop', () => {
    let clock = 8_000_000;
    const onPatch = vi.fn();
    render(<Harness initial={{ ...TIME_SET, durationSeconds: 40 }} onPatch={onPatch} now={() => clock} />);
    fireEvent.click(screen.getByTestId('set-hold-toggle'));
    clock += HOLD_MAX_REVIVE_MS + 1000;
    fireEvent.click(screen.getByTestId('set-hold-toggle'));
    expect(onPatch).not.toHaveBeenCalled();
    expect(screen.getByTestId('set-hold-toggle')).toHaveAttribute('aria-pressed', 'false');
    expect(sessionStorage.getItem('tytax-hold:t1')).toBeNull();
    // Up to the limit a long hold is still logged.
    fireEvent.click(screen.getByTestId('set-hold-toggle'));
    clock += HOLD_MAX_REVIVE_MS;
    fireEvent.click(screen.getByTestId('set-hold-toggle'));
    expect(onPatch).toHaveBeenLastCalledWith({ durationSeconds: HOLD_MAX_REVIVE_MS / 1000 });
  });
});
