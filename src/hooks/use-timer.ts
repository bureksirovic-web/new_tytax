'use client';
/**
 * `useTimer()` — the app's rest timer (G3), a live view over the persisted
 * `useRestTimerStore` (`src/stores/rest-timer-store.ts`, key
 * `tytax.rest-timer.v1`).
 *
 * Semantics follow `runtime/use-rest-timer.ts`: timestamp-based (`endsAt`),
 * re-derived from the wall clock every 250 ms while running and on every
 * `visibilitychange`, so it is correct after backgrounding or device sleep.
 * Because the state lives in the store, any caller (e.g. the set row marking a
 * set done) can start it with `useRestTimerStore.getState().start(seconds)` and
 * every mounted `useTimer()` follows.
 *
 * Completion: `onComplete` fires exactly once per rest period, then the timer
 * is cleared (`stop()`). A persisted timer that already expired before this
 * page loaded is cleared silently (no alert after a reload).
 *
 * Returns `{ hydrated, timer, remaining (whole s), progress (0..1), running,
 * start(durationS?), add(seconds = 30), stop() }`.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { isDone, type RestTimerState } from '@/components/workout/runtime/rest-timer';
import { DEFAULT_REST_S, REST_TICK_MS } from '@/components/workout/runtime/use-rest-timer';
import {
  REST_ADD_DEFAULT_S,
  restProgress,
  restRemaining,
  restRunning,
  useRestTimerHydrated,
  useRestTimerStore,
} from '@/stores/rest-timer-store';

export interface UseTimerOptions {
  /** Default rest length in seconds for `start()` without an argument. */
  defaultDurationS?: number;
  /** Called once per rest period when it reaches zero (while mounted). */
  onComplete?: () => void;
  /** Injectable clock, defaults to Date.now. */
  now?: () => number;
  /** Injectable document for visibility events; defaults to global document. */
  doc?: Pick<Document, 'addEventListener' | 'removeEventListener'> | null;
}

export interface TimerControls {
  hydrated: boolean;
  timer: RestTimerState | null;
  remaining: number;
  progress: number;
  running: boolean;
  start: (durationS?: number) => void;
  add: (seconds?: number) => void;
  stop: () => void;
}

export function useTimer(options: UseTimerOptions = {}): TimerControls {
  const { defaultDurationS = DEFAULT_REST_S } = options;
  const clock = options.now ?? Date.now;
  const clockRef = useRef(clock);
  const onCompleteRef = useRef(options.onComplete);
  useEffect(() => {
    clockRef.current = clock;
    onCompleteRef.current = options.onComplete;
  });

  const hydrated = useRestTimerHydrated();
  const timer = useRestTimerStore((s) => s.timer);
  const [now, setNow] = useState<number>(() => clock());
  const tick = useCallback(() => setNow(clockRef.current()), []);

  const running = hydrated && restRunning(timer, now);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(tick, REST_TICK_MS);
    return () => clearInterval(id);
  }, [running, tick]);

  const docOption = options.doc;
  useEffect(() => {
    const doc = docOption === undefined ? (typeof document === 'undefined' ? null : document) : docOption;
    if (!doc) return;
    doc.addEventListener('visibilitychange', tick);
    return () => doc.removeEventListener('visibilitychange', tick);
  }, [docOption, tick]);

  // Completion. The first hydrated pass clears an already-expired persisted
  // timer without firing; afterwards each `endsAt` fires at most once.
  const seenHydratedRef = useRef(false);
  const firedForRef = useRef<number | null>(null);
  useEffect(() => {
    if (!hydrated) return;
    const t = clockRef.current();
    if (!seenHydratedRef.current) {
      seenHydratedRef.current = true;
      if (timer && isDone(timer, t)) {
        firedForRef.current = timer.endsAt;
        useRestTimerStore.getState().stop();
        return;
      }
    }
    if (!timer || !isDone(timer, now)) return;
    if (firedForRef.current === timer.endsAt) return;
    firedForRef.current = timer.endsAt;
    onCompleteRef.current?.();
    useRestTimerStore.getState().stop();
  }, [hydrated, timer, now]);

  const start = useCallback(
    (durationS?: number) => {
      const t = clockRef.current();
      setNow(t);
      useRestTimerStore.getState().start(durationS ?? defaultDurationS, t);
    },
    [defaultDurationS],
  );

  const add = useCallback((seconds: number = REST_ADD_DEFAULT_S) => {
    const t = clockRef.current();
    setNow(t);
    useRestTimerStore.getState().add(seconds, t);
  }, []);

  const stop = useCallback(() => useRestTimerStore.getState().stop(), []);

  // A timer started elsewhere may be ahead of the last tick: never show more
  // than its total length.
  const visible = hydrated ? timer : null;
  const remaining = visible ? Math.min(restRemaining(visible, now), Math.ceil(visible.totalS)) : 0;

  return {
    hydrated,
    timer: visible,
    remaining,
    progress: restProgress(visible, now),
    running,
    start,
    add,
    stop,
  };
}
