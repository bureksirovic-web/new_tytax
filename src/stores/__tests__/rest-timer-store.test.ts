import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import {
  REST_TIMER_STORAGE_KEY,
  formatRest,
  restProgress,
  restRemaining,
  restRunning,
  useRestTimerHydrated,
  useRestTimerStore,
} from '../rest-timer-store';

const T0 = 1_700_000_000_000;
const s = () => useRestTimerStore.getState();

describe('rest timer store', () => {
  beforeEach(() => {
    s().stop();
    localStorage.clear();
  });

  it('start / add / stop with an explicit clock', () => {
    s().start(90, T0);
    expect(s().timer).toEqual({ endsAt: T0 + 90_000, totalS: 90 });
    s().add(30, T0 + 10_000);
    expect(s().timer).toEqual({ endsAt: T0 + 120_000, totalS: 120 });
    expect(restRemaining(s().timer, T0 + 60_000)).toBe(60);
    expect(restProgress(s().timer, T0 + 60_000)).toBe(0.5);
    expect(restRunning(s().timer, T0 + 60_000)).toBe(true);
    // After it ended, add restarts a fresh period from now.
    s().add(undefined, T0 + 200_000);
    expect(s().timer).toEqual({ endsAt: T0 + 230_000, totalS: 30 });
    s().stop();
    expect(s().timer).toBeNull();
    s().add(30, T0);
    expect(s().timer).toBeNull();
    expect([restRemaining(null, T0), restProgress(null, T0), restRunning(null, T0)]).toEqual([0, 0, false]);
  });

  it('defaults the clock to Date.now', () => {
    vi.spyOn(Date, 'now').mockReturnValue(T0);
    s().start(60);
    s().add();
    expect(s().timer).toEqual({ endsAt: T0 + 90_000, totalS: 90 });
    vi.restoreAllMocks();
  });

  it('formats m:ss', () => {
    expect([formatRest(0), formatRest(9), formatRest(90), formatRest(605), formatRest(-3)]).toEqual(['0:00', '0:09', '1:30', '10:05', '0:00']);
  });

  it('persists and rehydrates round-trip; rejects corrupt state', async () => {
    s().start(90, T0);
    const raw = localStorage.getItem(REST_TIMER_STORAGE_KEY);
    expect(JSON.parse(raw ?? '{}')).toEqual({ state: { timer: { endsAt: T0 + 90_000, totalS: 90 } }, version: 1 });
    s().stop();
    localStorage.setItem(REST_TIMER_STORAGE_KEY, raw ?? '');
    await useRestTimerStore.persist.rehydrate();
    expect(s().timer).toEqual({ endsAt: T0 + 90_000, totalS: 90 });

    localStorage.setItem(REST_TIMER_STORAGE_KEY, JSON.stringify({ state: { timer: { endsAt: 'x', totalS: 1 } }, version: 1 }));
    await useRestTimerStore.persist.rehydrate();
    expect(s().timer).toBeNull();
    localStorage.setItem(REST_TIMER_STORAGE_KEY, JSON.stringify({ state: { timer: { endsAt: T0, totalS: 5 } }, version: 0 }));
    await useRestTimerStore.persist.rehydrate();
    expect(s().timer).toEqual({ endsAt: T0, totalS: 5 });
    localStorage.setItem(REST_TIMER_STORAGE_KEY, JSON.stringify({ state: null, version: 0 }));
    await useRestTimerStore.persist.rehydrate();
    expect(s().timer).toBeNull();
  });

  it('useRestTimerHydrated rehydrates on mount', async () => {
    vi.resetModules();
    const fresh = await import('../rest-timer-store');
    localStorage.setItem(REST_TIMER_STORAGE_KEY, JSON.stringify({ state: { timer: { endsAt: T0, totalS: 5 } }, version: 1 }));
    expect(fresh.useRestTimerStore.persist.hasHydrated()).toBe(false);
    const { result } = renderHook(() => fresh.useRestTimerHydrated());
    await waitFor(() => expect(result.current).toBe(true));
    expect(fresh.useRestTimerStore.getState().timer).toEqual({ endsAt: T0, totalS: 5 });
    // the module-level hook on the already-imported store also works
    const again = renderHook(() => useRestTimerHydrated());
    await act(async () => {});
    expect(typeof again.result.current).toBe('boolean');
  });
});
