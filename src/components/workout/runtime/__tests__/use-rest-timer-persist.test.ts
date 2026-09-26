import { StrictMode, createElement, type ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useRestTimer } from '@/components/workout/runtime/use-rest-timer';

const T0 = 1_700_000_000_000;

describe('useRestTimer persistence and cleanup', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(T0);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('reports state changes for persistence (not the initial state)', () => {
    const onStateChange = vi.fn();
    const { result } = renderHook(() => useRestTimer({ defaultDurationS: 90, onStateChange }));
    expect(onStateChange).not.toHaveBeenCalled();
    act(() => result.current.start());
    expect(onStateChange).toHaveBeenLastCalledWith({ endsAt: T0 + 90_000, totalS: 90 });
    act(() => result.current.stop());
    expect(onStateChange).toHaveBeenLastCalledWith(null);
  });

  it('does not report the initial state under StrictMode', () => {
    const onStateChange = vi.fn();
    const wrapper = ({ children }: { children: ReactNode }) => createElement(StrictMode, null, children);
    const initialState = { endsAt: T0 + 5_000, totalS: 90 };
    const { result } = renderHook(() => useRestTimer({ initialState, onStateChange }), { wrapper });
    expect(onStateChange).not.toHaveBeenCalled();
    act(() => result.current.stop());
    expect(onStateChange).toHaveBeenCalledTimes(1);
    expect(onStateChange).toHaveBeenLastCalledWith(null);
  });

  it('add(0) / add(-30) after completion do not re-fire onComplete', () => {
    const onComplete = vi.fn();
    const { result } = renderHook(() => useRestTimer({ defaultDurationS: 2, onComplete }));
    act(() => result.current.start());
    act(() => {
      vi.advanceTimersByTime(2_000);
    });
    expect(onComplete).toHaveBeenCalledTimes(1);
    act(() => {
      vi.advanceTimersByTime(1_000);
      result.current.add(-30);
      result.current.add(0);
    });
    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(result.current.running).toBe(false);
  });

  it('hydrates a running timer and completes it once', () => {
    const onComplete = vi.fn();
    const initialState = { endsAt: T0 + 5_000, totalS: 90 };
    const { result } = renderHook(() => useRestTimer({ initialState, onComplete }));
    expect(result.current.running).toBe(true);
    expect(result.current.remaining).toBe(5);
    expect(result.current.progress).toBeCloseTo(85 / 90);
    act(() => {
      vi.advanceTimersByTime(5_000);
    });
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('does not fire for a hydrated timer that expired while closed', () => {
    const onComplete = vi.fn();
    const initialState = { endsAt: T0 - 60_000, totalS: 90 };
    const { result } = renderHook(() => useRestTimer({ initialState, onComplete }));
    expect(result.current.running).toBe(false);
    expect(result.current.remaining).toBe(0);
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('cleans up interval and listener on unmount', () => {
    const doc = new EventTarget() as unknown as Document;
    const remove = vi.spyOn(doc, 'removeEventListener');
    const { result, unmount } = renderHook(() => useRestTimer({ doc }));
    act(() => result.current.start());
    unmount();
    expect(vi.getTimerCount()).toBe(0);
    expect(remove).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
  });

  it('works with doc: null (no visibility source)', () => {
    const { result } = renderHook(() => useRestTimer({ doc: null, defaultDurationS: 3 }));
    act(() => result.current.start());
    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    expect(result.current.remaining).toBe(2);
  });
});
