/**
 * Request G5-10: with the `window.localStorage` getter throwing SecurityError
 * (Safari private mode, blocked site data), the persisted stores still have
 * their `persist` API, hydrate, and work in memory, instead of crashing the
 * route's error boundary ("Cannot read properties of undefined (reading
 * 'onHydrate')").
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';

const storageDescriptor = Object.getOwnPropertyDescriptor(window, 'localStorage');

function blockStorage(): () => number {
  let reads = 0;
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    get() {
      reads += 1;
      throw new DOMException('The operation is insecure.', 'SecurityError');
    },
  });
  return () => reads;
}

/** Fresh store modules, created while storage is blocked (as on a real page load). */
async function loadStores() {
  vi.resetModules();
  const workout = await import('../workout-store');
  const rest = await import('../rest-timer-store');
  return { ...workout, ...rest };
}

afterEach(() => {
  cleanup();
  if (storageDescriptor) Object.defineProperty(window, 'localStorage', storageDescriptor);
  window.localStorage.clear();
});

describe('persisted stores with blocked site storage (G5-10)', () => {
  it('the workout store hydrates and starts a draft in memory', async () => {
    const reads = blockStorage();
    const { useWorkoutStore, useWorkoutHydrated } = await loadStores();
    expect(reads()).toBeGreaterThan(0);
    expect(useWorkoutStore.persist).toBeDefined();

    function Probe() {
      const hydrated = useWorkoutHydrated();
      const draft = useWorkoutStore((s) => s.draft);
      return (
        <p data-testid="probe">
          {hydrated ? 'hydrated' : 'loading'}:{draft?.sessionName ?? 'none'}
        </p>
      );
    }

    render(<Probe />);
    await waitFor(() => expect(screen.getByTestId('probe')).toHaveTextContent('hydrated:none'));
    act(() => {
      useWorkoutStore.getState().startQuick('p1', 'Blocked storage');
    });
    expect(screen.getByTestId('probe')).toHaveTextContent('hydrated:Blocked storage');
    expect(useWorkoutStore.getState().draft?.profileId).toBe('p1');
  });

  it('the rest timer store hydrates and runs a timer in memory', async () => {
    blockStorage();
    const { useRestTimerStore, useRestTimerHydrated } = await loadStores();
    expect(useRestTimerStore.persist).toBeDefined();

    function Probe() {
      const hydrated = useRestTimerHydrated();
      const timer = useRestTimerStore((s) => s.timer);
      return <p data-testid="rest">{hydrated ? 'hydrated' : 'loading'}:{timer ? 'running' : 'idle'}</p>;
    }

    render(<Probe />);
    await waitFor(() => expect(screen.getByTestId('rest')).toHaveTextContent('hydrated:idle'));
    act(() => {
      useRestTimerStore.getState().start(90, 1_000);
    });
    expect(screen.getByTestId('rest')).toHaveTextContent('hydrated:running');
  });
});
