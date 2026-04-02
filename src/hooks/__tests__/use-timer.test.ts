import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTimer } from '../use-timer';

describe('useTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts with default seconds', () => {
    const { result } = renderHook(() => useTimer(60));
    expect(result.current.seconds).toBe(60);
  });

  it('starts with custom default when provided', () => {
    const { result } = renderHook(() => useTimer(120));
    expect(result.current.seconds).toBe(120);
  });

  it('is not running initially', () => {
    const { result } = renderHook(() => useTimer(30));
    expect(result.current.isRunning).toBe(false);
    expect(result.current.isPaused).toBe(false);
  });

  it('start() begins countdown', () => {
    const { result } = renderHook(() => useTimer(10));

    act(() => {
      result.current.start();
    });

    expect(result.current.isRunning).toBe(true);
    expect(result.current.isPaused).toBe(false);
  });

  it('start() with custom seconds overrides default', () => {
    const { result } = renderHook(() => useTimer(10));

    act(() => {
      result.current.start(20);
    });

    expect(result.current.seconds).toBe(20);
  });

  it('pause() stops countdown', () => {
    const { result } = renderHook(() => useTimer(10));

    act(() => {
      result.current.start();
    });

    expect(result.current.isRunning).toBe(true);

    act(() => {
      result.current.pause();
    });

    expect(result.current.isRunning).toBe(false);
    expect(result.current.isPaused).toBe(true);
  });

  it('resume() continues from paused value', () => {
    const { result } = renderHook(() => useTimer(10));

    act(() => {
      result.current.start();
    });

    act(() => {
      result.current.pause();
    });

    expect(result.current.isPaused).toBe(true);

    act(() => {
      result.current.resume();
    });

    expect(result.current.isRunning).toBe(true);
    expect(result.current.isPaused).toBe(false);
  });

  it('reset() returns to target', () => {
    const { result } = renderHook(() => useTimer(10));

    act(() => {
      result.current.start();
    });

    act(() => {
      result.current.reset();
    });

    expect(result.current.seconds).toBe(10);
    expect(result.current.isRunning).toBe(false);
    expect(result.current.isPaused).toBe(false);
  });

  it('progress calculates correctly at start', () => {
    const { result } = renderHook(() => useTimer(100));
    expect(result.current.progress).toBe(0);
  });

  it('progress calculates correctly halfway', () => {
    const { result } = renderHook(() => useTimer(10));

    act(() => {
      result.current.start();
    });

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(result.current.progress).toBeCloseTo(0.5);
  });

  it('isFinished is true when seconds reach 0', () => {
    const { result } = renderHook(() => useTimer(3));

    act(() => {
      result.current.start();
    });

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(result.current.seconds).toBe(0);
    expect(result.current.isRunning).toBe(false);
  });

  it('skip() sets seconds to 0 immediately', () => {
    const { result } = renderHook(() => useTimer(10));

    act(() => {
      result.current.start();
    });

    act(() => {
      result.current.skip();
    });

    expect(result.current.seconds).toBe(0);
    expect(result.current.isRunning).toBe(false);
  });
});
