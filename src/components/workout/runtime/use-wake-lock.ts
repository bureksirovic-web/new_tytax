'use client';
import { useEffect, useState } from 'react';

export interface WakeLockSentinelLike {
  released?: boolean;
  release(): Promise<void>;
  addEventListener?(type: 'release', listener: () => void): void;
}

export interface WakeLockLike {
  request(type: 'screen'): Promise<WakeLockSentinelLike>;
}

type VisibilityDoc = Pick<Document, 'addEventListener' | 'removeEventListener'> & {
  visibilityState: DocumentVisibilityState | string;
};

export interface UseWakeLockOptions {
  /** Injectable wake lock API; defaults to navigator.wakeLock. null = unsupported. */
  wakeLock?: WakeLockLike | null;
  /** Injectable document; defaults to global document. */
  doc?: VisibilityDoc | null;
}

function defaultWakeLock(): WakeLockLike | null {
  if (typeof navigator === 'undefined') return null;
  const wl = (navigator as Navigator & { wakeLock?: WakeLockLike }).wakeLock;
  return wl ?? null;
}

function releaseQuietly(sentinel: WakeLockSentinelLike): void {
  try {
    void sentinel.release().catch(() => undefined);
  } catch {
    /* already released */
  }
}

/**
 * Keeps the screen awake while `enabled`. Re-acquires the lock when the page
 * becomes visible again (browsers drop it on hide); releases on disable and
 * unmount. A no-op where the Wake Lock API is unavailable.
 */
export function useWakeLock(
  enabled: boolean,
  options: UseWakeLockOptions = {},
): { active: boolean } {
  const [active, setActive] = useState(false);
  const { wakeLock: wakeLockOption, doc: docOption } = options;

  useEffect(() => {
    const wakeLock = wakeLockOption === undefined ? defaultWakeLock() : wakeLockOption;
    const doc = docOption === undefined
      ? (typeof document === 'undefined' ? null : document)
      : docOption;
    if (!enabled || !wakeLock) return;

    let cancelled = false;
    let pending = false;
    let retry = false;
    let sentinel: WakeLockSentinelLike | null = null;

    const acquire = async () => {
      if (sentinel && !sentinel.released) return;
      if (pending) {
        // A visibility change arrived mid-request; re-check once it settles.
        retry = true;
        return;
      }
      pending = true;
      retry = false;
      try {
        const next = await wakeLock.request('screen');
        if (cancelled) {
          releaseQuietly(next);
          return;
        }
        sentinel = next;
        setActive(true);
        next.addEventListener?.('release', () => {
          if (sentinel !== next) return;
          sentinel = null;
          if (!cancelled) setActive(false);
        });
      } catch {
        if (!cancelled) setActive(false);
      } finally {
        pending = false;
        if (retry && !cancelled && !sentinel && doc?.visibilityState === 'visible') {
          void acquire();
        }
      }
    };

    const onVisibility = () => {
      if (doc?.visibilityState === 'visible') void acquire();
    };

    void acquire();
    doc?.addEventListener('visibilitychange', onVisibility);
    return () => {
      cancelled = true;
      doc?.removeEventListener('visibilitychange', onVisibility);
      if (sentinel) releaseQuietly(sentinel);
      sentinel = null;
      setActive(false);
    };
  }, [enabled, wakeLockOption, docOption]);

  return { active: enabled && active };
}
