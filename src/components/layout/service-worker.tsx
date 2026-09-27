'use client';
import { useEffect } from 'react';

/** Loads every catalog chunk so the worker sees (and caches) them. Dynamic: stays out of first-load JS. */
async function warmCatalog(): Promise<void> {
  const { catalog } = await import('@/lib/catalog');
  await catalog.preloadAll();
}

/** In dev, chunk URLs are not content-hashed: the worker must prefer the network. */
const SW_URL = process.env.NODE_ENV === 'production' ? '/sw.js' : '/sw.js?dev=1';

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
export function ServiceWorker() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    let cancelled = false;
    (async () => {
      try {
        await navigator.serviceWorker.register(SW_URL);
        const reg = await navigator.serviceWorker.ready;
        await warmCatalog();
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
  }, []);
  return null;
}
