import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import type { RestAlerts } from '@/components/workout/runtime/rest-alerts';
import { RestTimerBar, progressPercent, spaceBelongsToTarget } from '../rest-timer-bar';
import { useRestTimerStore } from '@/stores/rest-timer-store';

const T0 = Date.UTC(2026, 8, 26, 10, 0, 0);

function fakeAlerts() {
  return {
    vibrate: vi.fn(() => true),
    beep: vi.fn(() => true),
    speak: vi.fn(() => true),
    unlock: vi.fn(() => true),
    fire: vi.fn(() => ({ vibrate: true, sound: true, voice: false })),
  } satisfies RestAlerts;
}

async function renderBar(voiceCues = false) {
  const alerts = fakeAlerts();
  const view = render(<RestTimerBar voiceCues={voiceCues} alerts={alerts} />);
  await act(async () => {});
  return { alerts, ...view };
}

function startRest(seconds: number) {
  act(() => useRestTimerStore.getState().start(seconds, Date.now()));
}

describe('RestTimerBar', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(T0);
    localStorage.clear();
    useRestTimerStore.setState({ timer: null });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders nothing without a running rest', async () => {
    await renderBar();
    expect(screen.queryByTestId('rest-timer')).toBeNull();
  });

  it('shows m:ss and progress, counting down on the wall clock', async () => {
    await renderBar();
    startRest(90);
    expect(screen.getByTestId('rest-timer-remaining')).toHaveTextContent('1:30');
    const bar = screen.getByTestId('rest-timer-progress');
    expect(bar).toHaveAttribute('role', 'progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '0');
    act(() => {
      vi.advanceTimersByTime(45_000);
    });
    // 90 - 45 = 45 s → "0:45"; 45/90 = 50 %.
    expect(screen.getByTestId('rest-timer-remaining')).toHaveTextContent('0:45');
    expect(bar).toHaveAttribute('aria-valuenow', '50');
  });

  it('+30 adds thirty seconds, stop hides the bar', async () => {
    await renderBar();
    startRest(60);
    fireEvent.click(screen.getByTestId('rest-timer-add30'));
    // 60 + 30 = 90 s → "1:30".
    expect(screen.getByTestId('rest-timer-remaining')).toHaveTextContent('1:30');
    fireEvent.click(screen.getByTestId('rest-timer-stop'));
    expect(screen.queryByTestId('rest-timer')).toBeNull();
    expect(useRestTimerStore.getState().timer).toBeNull();
  });

  it('fires vibrate + beep once on completion, no voice when voiceCues is off', async () => {
    const { alerts } = await renderBar(false);
    startRest(2);
    act(() => {
      vi.advanceTimersByTime(2_000);
    });
    expect(alerts.fire).toHaveBeenCalledTimes(1);
    expect(alerts.fire).toHaveBeenCalledWith({ vibrate: true, sound: true, voice: null });
    expect(screen.queryByTestId('rest-timer')).toBeNull();
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(alerts.fire).toHaveBeenCalledTimes(1);
  });

  it('speaks the localized line when voiceCues is on (default locale en)', async () => {
    const { alerts } = await renderBar(true);
    startRest(1);
    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    expect(alerts.fire).toHaveBeenCalledWith({
      vibrate: true,
      sound: true,
      voice: { text: 'Rest complete', lang: 'en-US' },
    });
  });

  it('Space stops the timer, but not while typing in an input', async () => {
    await renderBar();
    const input = document.createElement('input');
    document.body.appendChild(input);
    startRest(60);
    fireEvent.keyDown(input, { key: ' ', code: 'Space' });
    expect(screen.getByTestId('rest-timer')).toBeInTheDocument();
    fireEvent.keyDown(document.body, { key: ' ', code: 'Space' });
    expect(screen.queryByTestId('rest-timer')).toBeNull();
    input.remove();
  });

  it('unlocks audio on the first user gesture', async () => {
    const { alerts } = await renderBar();
    fireEvent.pointerDown(document.body);
    fireEvent.pointerDown(document.body);
    expect(alerts.unlock).toHaveBeenCalledTimes(1);
  });

  it('survives a remount (reload) mid-rest', async () => {
    const first = await renderBar();
    startRest(90);
    act(() => {
      vi.advanceTimersByTime(30_000);
    });
    first.unmount();
    await renderBar();
    // 90 - 30 = 60 s → "1:00".
    expect(screen.getByTestId('rest-timer-remaining')).toHaveTextContent('1:00');
  });
});

describe('rest-timer-bar helpers', () => {
  it('progressPercent clamps to 0..100', () => {
    expect(progressPercent(-1)).toBe(0);
    expect(progressPercent(0.504)).toBe(50);
    expect(progressPercent(2)).toBe(100);
    expect(progressPercent(Number.NaN)).toBe(0);
  });

  it('spaceBelongsToTarget recognises form controls and buttons', () => {
    expect(spaceBelongsToTarget(document.createElement('input'))).toBe(true);
    expect(spaceBelongsToTarget(document.createElement('textarea'))).toBe(true);
    expect(spaceBelongsToTarget(document.createElement('button'))).toBe(true);
    const editable = document.createElement('div');
    editable.setAttribute('contenteditable', 'true');
    expect(spaceBelongsToTarget(editable)).toBe(true);
    expect(spaceBelongsToTarget(document.createElement('div'))).toBe(false);
    expect(spaceBelongsToTarget(null)).toBe(false);
  });

  it('spaceBelongsToTarget also leaves links, summaries and ARIA widgets alone', () => {
    const link = document.createElement('a');
    link.href = 'https://example.com';
    expect(spaceBelongsToTarget(link)).toBe(true);
    expect(spaceBelongsToTarget(document.createElement('summary'))).toBe(true);
    for (const role of ['checkbox', 'switch', 'radio', 'tab', 'option', 'link']) {
      const el = document.createElement('div');
      el.setAttribute('role', role);
      expect(spaceBelongsToTarget(el)).toBe(true);
    }
  });
});
