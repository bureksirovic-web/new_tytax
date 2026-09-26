'use client';
/**
 * Hold timer for time-measured sets (Wave 2, F2). Timestamp based: the
 * elapsed time is `now() - startedAt`, recomputed on every tick, so a
 * throttled or backgrounded tab still reads the true hold on return. The
 * interval only drives re-renders; it never accumulates time.
 *
 * With a `storageKey` (the set id) a running hold's `startedAt` is kept in
 * sessionStorage (`tytax-hold:<key>`), so a reload or a tab the mobile
 * browser discarded and restored comes back still running with the true
 * elapsed time. Storage failures (private mode, blocked) fall back to memory.
 */
import { useCallback, useEffect, useState } from 'react';

/** Re-render cadence while a hold runs. */
export const HOLD_TICK_MS = 250;

/** Whole seconds between `startedAt` and `now` (ms timestamps); 0 for a clock that went backwards or bad input. */
export function holdElapsedSeconds(startedAt: number, now: number): number {
  const ms = now - startedAt;
  if (!Number.isFinite(ms) || ms <= 0) return 0;
  return Math.floor(ms / 1000);
}

export interface HoldTimer {
  running: boolean;
  /** Whole seconds held so far; 0 when idle. */
  elapsed: number;
  start(): void;
  /** Stops the hold and returns its whole seconds (0 when it was not running). */
  stop(): number;
}

export const HOLD_STORAGE_PREFIX = 'tytax-hold:';

/** Persisted start of a running hold, or null (missing, unreadable or not a finite number). */
export function readHoldStart(storageKey: string | undefined): number | null {
  if (!storageKey || typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(HOLD_STORAGE_PREFIX + storageKey);
    const value = raw === null ? Number.NaN : Number(raw);
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

function writeHoldStart(storageKey: string | undefined, startedAt: number | null): void {
  if (!storageKey || typeof window === 'undefined') return;
  try {
    const key = HOLD_STORAGE_PREFIX + storageKey;
    if (startedAt === null) window.sessionStorage.removeItem(key);
    else window.sessionStorage.setItem(key, String(startedAt));
  } catch {
    // Memory only: the hold still works until the page goes away.
  }
}

export function useHoldTimer(now: () => number = Date.now, tickMs: number = HOLD_TICK_MS, storageKey?: string): HoldTimer {
  const [startedAt, setStartedAt] = useState<number | null>(() => readHoldStart(storageKey));
  const [, setTick] = useState(0);

  useEffect(() => {
    if (startedAt === null) return;
    const id = setInterval(() => setTick((n) => n + 1), tickMs);
    return () => clearInterval(id);
  }, [startedAt, tickMs]);

  const start = useCallback(() => {
    const at = now();
    writeHoldStart(storageKey, at);
    setStartedAt(at);
  }, [now, storageKey]);
  const stop = useCallback((): number => {
    if (startedAt === null) return 0;
    const seconds = holdElapsedSeconds(startedAt, now());
    writeHoldStart(storageKey, null);
    setStartedAt(null);
    return seconds;
  }, [now, startedAt, storageKey]);

  return {
    running: startedAt !== null,
    elapsed: startedAt === null ? 0 : holdElapsedSeconds(startedAt, now()),
    start,
    stop,
  };
}
