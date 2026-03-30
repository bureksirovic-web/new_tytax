'use client';
import { useState, useEffect, useCallback, useRef } from 'react';

export function useTimer(defaultSeconds = 90) {
  const [target, setTarget] = useState(defaultSeconds);
  const [seconds, setSeconds] = useState(defaultSeconds);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTick = () => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const tick = useCallback(() => {
    setSeconds((s) => {
      if (s <= 1) {
        clearTick();
        setIsRunning(false);
        setIsPaused(false);
        return 0;
      }
      return s - 1;
    });
  }, []);

  const start = useCallback(
    (secs?: number) => {
      const duration = secs ?? target;
      clearTick();
      setTarget(duration);
      setSeconds(duration);
      setIsRunning(true);
      setIsPaused(false);
      intervalRef.current = setInterval(tick, 1000);
    },
    [target, tick]
  );

  const pause = useCallback(() => {
    if (!isRunning || isPaused) return;
    clearTick();
    setIsPaused(true);
    setIsRunning(false);
  }, [isRunning, isPaused]);

  const resume = useCallback(() => {
    if (!isPaused) return;
    setIsPaused(false);
    setIsRunning(true);
    intervalRef.current = setInterval(tick, 1000);
  }, [isPaused, tick]);

  const reset = useCallback(() => {
    clearTick();
    setSeconds(target);
    setIsRunning(false);
    setIsPaused(false);
  }, [target]);

  const skip = useCallback(() => {
    clearTick();
    setSeconds(0);
    setIsRunning(false);
    setIsPaused(false);
  }, []);

  useEffect(() => {
    return () => clearTick();
  }, []);

  const progress = target > 0 ? (target - seconds) / target : 1;

  return {
    seconds,
    isRunning,
    isPaused,
    progress,
    start,
    pause,
    resume,
    reset,
    skip,
  };
}
