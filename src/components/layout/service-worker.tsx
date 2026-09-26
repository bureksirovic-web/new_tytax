'use client';
import { useEffect } from 'react';

interface ServiceWorkerProps {
  /** Loads every lazy chunk the app may need offline (e.g. all catalog chunks). */
  warm?: () => Promise<unknown>;
}

/** Same-origin static chunk URLs this page has already loaded. */
function loadedStaticUrls(): string[] {
  if (typeof performance === 'undefined') return [];
  return performance
    .getEntriesByType('resource')
    .map((e) => e.name)
    .filter((u) => {
      try {
        const url = new URL(u);
        return url.origin === window.location.origin && url.pathname.startsWith('/_next/static/');
      } catch {
        return false;
      }
    });
}

function postCacheUrls(sw: ServiceWorker, urls: string[]): Promise<void> {
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    const timer = window.setTimeout(resolve, 15000);
    channel.port1.onmessage = () => {
      window.clearTimeout(timer);
      resolve();
    };
    sw.postMessage({ type: 'CACHE_URLS', urls }, [channel.port2]);
  });
}

/**
 * Registers /sw.js, then hands it every chunk loaded so far and warms all lazy
 * chunks so the shell and the whole catalog work offline after the first visit.
 * Sets `data-sw-ready` on <html> when done (used by e2e/offline.spec.ts).
 */
export function ServiceWorker({ warm }: ServiceWorkerProps) {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    let cancelled = false;
    (async () => {
      try {
        await navigator.serviceWorker.register('/sw.js');
        const reg = await navigator.serviceWorker.ready;
        if (warm) await warm();
        const active = reg.active;
        if (!active || cancelled) return;
        await postCacheUrls(active, [...loadedStaticUrls(), window.location.pathname]);
        if (!cancelled) document.documentElement.dataset.swReady = '1';
      } catch (err) {
        console.error('[sw] registration failed', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [warm]);
  return null;
}
