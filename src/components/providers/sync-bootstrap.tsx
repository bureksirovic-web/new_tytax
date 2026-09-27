'use client';

import { useEffect } from 'react';
import { installSyncAdapter } from '@/lib/sync/install';

/**
 * Sync lifecycle for the app. The (deferred) adapter is installed into the
 * repository at module init of the providers tree (./index.tsx) and again at
 * the start of AppBootstrap, both before the app's first write. This
 * component loads the sync code (dynamic import, outside the first-load
 * bundle), starts the automatic triggers and a first sync, and stops the
 * triggers on unmount. Flag off: `installSyncAdapter()` returns the no-op
 * adapter and nothing is loaded.
 */
export function SyncBootstrap(): null {
  useEffect(() => {
    const adapter = installSyncAdapter();
    if (!adapter.enabled) return;
    let cancelled = false;
    let stop: (() => void) | null = null;
    import('@/lib/sync')
      .then(({ getSyncAdapter, startAutoSync }) => {
        if (cancelled) return;
        stop = startAutoSync(getSyncAdapter());
        // Single-flight: Strict Mode's second mount joins the same run.
        void adapter.syncNow();
      })
      .catch(() => {
        // Chunk load failed (offline first visit): the next syncNow retries the load.
      });
    return () => {
      cancelled = true;
      stop?.();
    };
  }, []);
  return null;
}
