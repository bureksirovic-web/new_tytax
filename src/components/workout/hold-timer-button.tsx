'use client';
import { formatDuration } from '@/stores/measure';
import type { HoldTimer } from './hold-timer';
import { PlayIcon } from './icons';

export interface HoldTimerButtonProps {
  /** Receives the held whole seconds when the hold is stopped. */
  onStop: (seconds: number) => void;
  /** Accessible name while idle. */
  startLabel: string;
  /** Accessible name while running; receives the elapsed m:ss. */
  stopLabel: (elapsed: string) => string;
  /** The row's hold timer (`useHoldTimer`), owned by the row so typing can cancel it. */
  hold: HoldTimer;
}

function StopIcon() {
  return (
    <svg className="h-3.5 w-3.5 sm:h-4 sm:w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
      <rect x="6" y="6" width="12" height="12" rx="1.5" />
    </svg>
  );
}

/**
 * Start/stop hold timer for a time set (testid set-hold-toggle, aria-pressed
 * while running). While running it shows the elapsed m:ss
 * (testid set-hold-elapsed); stopping hands the seconds to `onStop`.
 * Phones get a compact running state (text-xs, 14 px icon) so the duration
 * input next to it keeps room for "10:45" at 360 px.
 */
export function HoldTimerButton({ onStop, startLabel, stopLabel, hold }: HoldTimerButtonProps) {
  const elapsed = formatDuration(hold.elapsed);

  function toggle() {
    if (hold.running) onStop(hold.stop());
    else hold.start();
  }

  return (
    <button
      type="button"
      data-testid="set-hold-toggle"
      aria-pressed={hold.running}
      aria-label={hold.running ? stopLabel(elapsed) : startLabel}
      onClick={toggle}
      className={`flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-0.5 rounded-lg border px-0.5 font-mono sm:gap-1 sm:px-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--highlight)] ${
        hold.running
          ? 'border-[var(--highlight)] bg-[var(--highlight)] text-white'
          : 'border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-secondary)]'
      }`}
    >
      {hold.running ? <StopIcon /> : <PlayIcon className="h-4 w-4" />}
      {hold.running && (
        <span data-testid="set-hold-elapsed" role="timer" className="text-xs tabular-nums sm:text-sm">
          {elapsed}
        </span>
      )}
    </button>
  );
}
