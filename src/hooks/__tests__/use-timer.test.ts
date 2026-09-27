import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTimer } from '../use-timer';
import { REST_TIMER_STORAGE_KEY, useRestTimerStore } from '@/stores/rest-timer-store';

const T0 = Date.UTC(2026, 8, 26, 10, 0, 0);

/** Writes storage and re-reads it, as a page reload would. */
async function persist(timer: { endsAt: number; totalS: number } | null) {
  localStorage.setItem(REST_TIMER_STORAGE_KEY, JSON.stringify({ state: { timer }, version: 1 }));
  await useRestTimerStore.persist.rehydrate();
}

async function mount(opts: Parameters<typeof useTimer>[0] = {}) {
  const hook = renderHook(() => useTimer(opts));
  await act(async () => {});
  return hook;
}

describe('useTimer (persisted rest timer)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(T0);
    localStorage.clear();
    useRestTimerStore.setState({ timer: null });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('is idle with no timer', async () => {
    const { result } = await mount();
    expect(result.current.hydrated).toBe(true);
    expect(result.current.running).toBe(false);
    expect(result.current.remaining).toBe(0);
    expect(result.current.progress).toBe(0);
  });

  it('start() uses the default duration and writes the store', async () => {
    const { result } = await mount({ defaultDurationS: 120 });
    act(() => result.current.start());
    expect(result.current.running).toBe(true);
    expect(result.current.remaining).toBe(120);
    // endsAt = T0 + 120 s.
    expect(useRestTimerStore.getState().timer).toEqual({ endsAt: T0 + 120_000, totalS: 120 });
  });

  it('counts down from the wall clock; halfway progress is 0.5', async () => {
    const { result } = await mount();
    act(() => result.current.start(10));
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    // 10 s - 5 s = 5 s left, 5/10 = 0.5 elapsed.
    expect(result.current.remaining).toBe(5);
    expect(result.current.progress).toBeCloseTo(0.5);
  });

  it('follows a timer started elsewhere through the store', async () => {
    const { result } = await mount();
    act(() => useRestTimerStore.getState().start(60, Date.now()));
    expect(result.current.running).toBe(true);
    expect(result.current.remaining).toBe(60);
  });

  it('never shows more than the total when the last tick is stale', async () => {
    let clock = T0;
    const { result } = await mount({ now: () => clock });
    clock = T0 + 600_000;
    act(() => useRestTimerStore.getState().start(60, clock));
    // Hook `now` is still T0 (10 min earlier); remaining is capped at totalS = 60.
    expect(result.current.remaining).toBe(60);
  });

  it('add(30) extends a running rest', async () => {
    const { result } = await mount();
    act(() => result.current.start(60));
    act(() => result.current.add());
    // 60 + 30 = 90.
    expect(result.current.remaining).toBe(90);
    expect(useRestTimerStore.getState().timer?.totalS).toBe(90);
  });

  it('stop() clears the timer', async () => {
    const { result } = await mount();
    act(() => result.current.start(60));
    act(() => result.current.stop());
    expect(result.current.running).toBe(false);
    expect(useRestTimerStore.getState().timer).toBeNull();
  });

  it('fires onComplete exactly once, then clears the timer', async () => {
    const onComplete = vi.fn();
    const { result } = await mount({ onComplete });
    act(() => result.current.start(3));
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(result.current.running).toBe(false);
    expect(useRestTimerStore.getState().timer).toBeNull();
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('is correct after backgrounding: a visibility change re-reads the clock', async () => {
    let clock = T0;
    const onComplete = vi.fn();
    const { result } = await mount({ now: () => clock, onComplete });
    act(() => result.current.start(90));
    // Background: no interval ticks arrive, then the tab comes back 40 s later.
    clock = T0 + 40_000;
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    // 90 - 40 = 50 s left.
    expect(result.current.remaining).toBe(50);
    clock = T0 + 200_000;
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('restores a running rest from storage after a reload', async () => {
    await persist({ endsAt: T0 + 45_000, totalS: 90 });
    const { result } = await mount();
    expect(result.current.running).toBe(true);
    // endsAt - now = 45 s; 45/90 elapsed = 0.5.
    expect(result.current.remaining).toBe(45);
    expect(result.current.progress).toBeCloseTo(0.5);
  });

  it('clears an expired persisted rest without firing', async () => {
    await persist({ endsAt: T0 - 1000, totalS: 90 });
    const onComplete = vi.fn();
    const { result } = await mount({ onComplete });
    expect(result.current.running).toBe(false);
    expect(onComplete).not.toHaveBeenCalled();
    expect(useRestTimerStore.getState().timer).toBeNull();
  });
});
