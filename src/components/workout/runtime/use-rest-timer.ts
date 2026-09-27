'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  addSeconds,
  isDone,
  progress as progressOf,
  remaining as remainingOf,
  start as startTimer,
  type RestTimerState,
} from '@/components/workout/runtime/rest-timer';

export const REST_TICK_MS = 250;
export const DEFAULT_REST_S = 90;

export interface UseRestTimerOptions {
  /** Default rest length in seconds (caller passes the settings value). */
  defaultDurationS?: number;
  /** Called exactly once per rest period when it reaches zero. */
  onComplete?: () => void;
  /** Called with the new state whenever it changes (for persistence). */
  onStateChange?: (state: RestTimerState | null) => void;
  /** Hydrated state (e.g. from storage). Already-expired state does not fire. */
  initialState?: RestTimerState | null;
  /** Injectable clock, defaults to Date.now. */
  now?: () => number;
  /** Injectable document for visibility events; defaults to global document. */
  doc?: Pick<Document, 'addEventListener' | 'removeEventListener'> | null;
}

export interface RestTimerControls {
  remaining: number;
  progress: number;
  running: boolean;
  state: RestTimerState | null;
  start: (durationS?: number) => void;
  add: (seconds?: number) => void;
  stop: () => void;
}

export function useRestTimer(options: UseRestTimerOptions = {}): RestTimerControls {
  const { defaultDurationS = DEFAULT_REST_S, initialState = null } = options;
  const clock = options.now ?? Date.now;

  const clockRef = useRef(clock);
  const onCompleteRef = useRef(options.onComplete);
  const onStateChangeRef = useRef(options.onStateChange);
  useEffect(() => {
    clockRef.current = clock;
    onCompleteRef.current = options.onComplete;
    onStateChangeRef.current = options.onStateChange;
  });

  const [timer, setTimer] = useState<RestTimerState | null>(initialState);
  const [now, setNow] = useState<number>(() => clock());
  // A hydrated timer that already expired must not fire again after reload.
  const [expiredAtMount] = useState<number | null>(() =>
    initialState && isDone(initialState, clock()) ? initialState.endsAt : null,
  );
  const firedForRef = useRef<number | null>(expiredAtMount);

  const running = timer !== null && !isDone(timer, now);

  const tick = useCallback(() => {
    setNow(clockRef.current());
  }, []);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(tick, REST_TICK_MS);
    return () => clearInterval(id);
  }, [running, tick]);

  const docOption = options.doc;
  useEffect(() => {
    const doc = docOption === undefined
      ? (typeof document === 'undefined' ? null : document)
      : docOption;
    if (!doc) return;
    doc.addEventListener('visibilitychange', tick);
    return () => doc.removeEventListener('visibilitychange', tick);
  }, [docOption, tick]);

  useEffect(() => {
    if (!timer || !isDone(timer, now)) return;
    if (firedForRef.current === timer.endsAt) return;
    firedForRef.current = timer.endsAt;
    onCompleteRef.current?.();
  }, [timer, now]);

  // Compare against the last reported value (not a first-run flag) so
  // StrictMode's double-invoked mount effect does not report initial state.
  const lastReportedRef = useRef<RestTimerState | null>(initialState);
  useEffect(() => {
    if (timer === lastReportedRef.current) return;
    lastReportedRef.current = timer;
    onStateChangeRef.current?.(timer);
  }, [timer]);

  const start = useCallback(
    (durationS?: number) => {
      const t = clockRef.current();
      firedForRef.current = null;
      setNow(t);
      setTimer(startTimer(t, durationS ?? defaultDurationS));
    },
    [defaultDurationS],
  );

  const add = useCallback((seconds = 30) => {
    const t = clockRef.current();
    setNow(t);
    setTimer((prev) => (prev ? addSeconds(prev, seconds, t) : prev));
  }, []);

  const stop = useCallback(() => {
    setTimer(null);
  }, []);

  return {
    remaining: timer ? remainingOf(timer, now) : 0,
    progress: timer ? progressOf(timer, now) : 0,
    running,
    state: timer,
    start,
    add,
    stop,
  };
}
