import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_REST_S, useRestTimer } from '@/components/workout/runtime/use-rest-timer';

const T0 = 1_700_000_000_000;

describe('useRestTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(T0);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts idle', () => {
    const { result } = renderHook(() => useRestTimer());
    expect(result.current).toMatchObject({ remaining: 0, progress: 0, running: false, state: null });
  });

  it('start() uses the default duration (90 unless the caller passes one)', () => {
    const { result } = renderHook(() => useRestTimer());
    act(() => result.current.start());
    expect(DEFAULT_REST_S).toBe(90);
    expect(result.current.remaining).toBe(90);
    expect(result.current.running).toBe(true);

    const custom = renderHook(() => useRestTimer({ defaultDurationS: 120 }));
    act(() => custom.result.current.start());
    expect(custom.result.current.remaining).toBe(120);
  });

  it('start(durationS) overrides the default', () => {
    const { result } = renderHook(() => useRestTimer());
    act(() => result.current.start(45));
    expect(result.current.remaining).toBe(45);
  });

  it('ticks down on a 250ms interval', () => {
    const { result } = renderHook(() => useRestTimer({ defaultDurationS: 10 }));
    act(() => result.current.start());
    act(() => {
      vi.advanceTimersByTime(3_000);
    });
    expect(result.current.remaining).toBe(7);
    expect(result.current.progress).toBeCloseTo(0.3);
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(result.current.remaining).toBe(7);
  });

  it('derives from the clock, not a counter (throttled intervals stay correct)', () => {
    let fakeNow = T0;
    const { result } = renderHook(() => useRestTimer({ defaultDurationS: 60, now: () => fakeNow }));
    act(() => result.current.start());
    // Background: the clock jumps 40s but only one interval fires.
    fakeNow += 40_000;
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(result.current.remaining).toBe(20);
  });

  it('recomputes on visibilitychange without waiting for a tick', () => {
    let fakeNow = T0;
    const doc = new EventTarget() as unknown as Document;
    const { result } = renderHook(() =>
      useRestTimer({ defaultDurationS: 60, now: () => fakeNow, doc }),
    );
    act(() => result.current.start());
    fakeNow += 50_000;
    act(() => {
      doc.dispatchEvent(new Event('visibilitychange'));
    });
    expect(result.current.remaining).toBe(10);
  });

  it('listens on the global document by default', () => {
    let fakeNow = T0;
    const { result } = renderHook(() => useRestTimer({ defaultDurationS: 60, now: () => fakeNow }));
    act(() => result.current.start());
    fakeNow += 30_000;
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(result.current.remaining).toBe(30);
  });

  it('fires onComplete exactly once and stops running', () => {
    const onComplete = vi.fn();
    const { result } = renderHook(() => useRestTimer({ defaultDurationS: 2, onComplete }));
    act(() => result.current.start());
    act(() => {
      vi.advanceTimersByTime(1_750);
    });
    expect(onComplete).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(result.current.running).toBe(false);
    expect(result.current.remaining).toBe(0);
    expect(result.current.progress).toBe(1);
    act(() => {
      vi.advanceTimersByTime(10_000);
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('fires again for a new rest period', () => {
    const onComplete = vi.fn();
    const { result } = renderHook(() => useRestTimer({ defaultDurationS: 1, onComplete }));
    act(() => result.current.start());
    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    act(() => result.current.start());
    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    expect(onComplete).toHaveBeenCalledTimes(2);
  });

  it('uses the latest onComplete callback', () => {
    const first = vi.fn();
    const second = vi.fn();
    const { result, rerender } = renderHook(({ cb }) => useRestTimer({ defaultDurationS: 1, onComplete: cb }), {
      initialProps: { cb: first },
    });
    act(() => result.current.start());
    rerender({ cb: second });
    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('add(30) extends a running timer, default +30', () => {
    const { result } = renderHook(() => useRestTimer({ defaultDurationS: 60 }));
    act(() => result.current.start());
    act(() => {
      vi.advanceTimersByTime(20_000);
    });
    act(() => result.current.add());
    expect(result.current.remaining).toBe(70);
    expect(result.current.state?.totalS).toBe(90);
    act(() => result.current.add(15));
    expect(result.current.remaining).toBe(85);
  });

  it('add() on an idle timer does nothing; on a finished one restarts', () => {
    const onComplete = vi.fn();
    const { result } = renderHook(() => useRestTimer({ defaultDurationS: 1, onComplete }));
    act(() => result.current.add());
    expect(result.current.running).toBe(false);
    act(() => result.current.start());
    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    act(() => result.current.add(30));
    expect(result.current.running).toBe(true);
    expect(result.current.remaining).toBe(30);
    act(() => {
      vi.advanceTimersByTime(30_000);
    });
    expect(onComplete).toHaveBeenCalledTimes(2);
  });

  it('stop() cancels without firing onComplete and clears the interval', () => {
    const onComplete = vi.fn();
    const { result } = renderHook(() => useRestTimer({ defaultDurationS: 5, onComplete }));
    act(() => result.current.start());
    act(() => result.current.stop());
    expect(result.current).toMatchObject({ running: false, remaining: 0, state: null });
    expect(vi.getTimerCount()).toBe(0);
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(onComplete).not.toHaveBeenCalled();
  });
});
