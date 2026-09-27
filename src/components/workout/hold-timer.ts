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
 *
 * Abandoned holds (refuter-2 F2): a stored start is revived only when it is
 * at most `HOLD_MAX_REVIVE_MS` (30 min) old and `revive` is true (the caller
 * passes false for a set already done); otherwise the key is removed and the
 * timer starts idle. `cancel()` drops a running hold without a result (the
 * row calls it when the athlete types a duration or the set becomes done),
 * so a later stop can never overwrite a value typed by hand. A hold left
 * running longer than `HOLD_MAX_REVIVE_MS` without a reload is abandoned too:
 * its `stop()` returns 0, so it writes nothing.
 */
import { useCallback, useEffect, useState } from 'react';
import { HOLD_STORAGE_PREFIX } from '@/stores/hold-storage';

export { HOLD_STORAGE_PREFIX };

/** Re-render cadence while a hold runs. */
export const HOLD_TICK_MS = 250;

/** Oldest stored hold that is revived on mount; older is treated as abandoned. */
export const HOLD_MAX_REVIVE_MS = 30 * 60 * 1000;

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
  /** Stops the hold and returns its whole seconds (0 when it was not running or ran past `HOLD_MAX_REVIVE_MS`). */
  stop(): number;
  /** Drops a running hold without a result. */
  cancel(): void;
}

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

/** The stored start when it may be revived (fresh, `revive`); otherwise removes it and returns null. */
export function reviveHoldStart(storageKey: string | undefined, now: number, revive = true): number | null {
  const at = readHoldStart(storageKey);
  if (at === null) return null;
  const age = now - at;
  if (revive && age >= 0 && age <= HOLD_MAX_REVIVE_MS) return at;
  writeHoldStart(storageKey, null);
  return null;
}

export function useHoldTimer(now: () => number = Date.now, tickMs: number = HOLD_TICK_MS, storageKey?: string, revive = true): HoldTimer {
  const [startedAt, setStartedAt] = useState<number | null>(() => reviveHoldStart(storageKey, now(), revive));
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
    // Abandoned (refuter-2 F2): a hold past the revive limit is never logged.
    return seconds * 1000 > HOLD_MAX_REVIVE_MS ? 0 : seconds;
  }, [now, startedAt, storageKey]);
  const cancel = useCallback(() => {
    writeHoldStart(storageKey, null);
    setStartedAt(null);
  }, [storageKey]);

  return {
    running: startedAt !== null,
    elapsed: startedAt === null ? 0 : holdElapsedSeconds(startedAt, now()),
    start,
    stop,
    cancel,
  };
}
