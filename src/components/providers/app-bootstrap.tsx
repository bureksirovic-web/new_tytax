'use client';

import { useEffect } from 'react';
import { getRepository } from '@/lib/db';
import { installSyncAdapter } from '@/lib/sync/install';

/** First-run profile name. User data (renamed in settings), not a UI string. */
const DEFAULT_PROFILE_NAME = 'Profil 1';

/** One bootstrap per page load; dedupes React Strict Mode's double effect run. */
let booting: Promise<void> | null = null;

async function bootstrap(): Promise<void> {
  // Idempotent; the providers module already did it. Here it guarantees the
  // ordering even when AppBootstrap is mounted on its own (tests).
  if (process.env.NEXT_PUBLIC_SYNC_ENABLED === 'true') installSyncAdapter();
  const repo = getRepository();
  await repo.profiles.ensureActive(DEFAULT_PROFILE_NAME);
  // Inlined at build time: a production build without NEXT_PUBLIC_E2E_HOOKS=1
  // folds this to `false` and drops the e2e-hooks chunk.
  if (process.env.NODE_ENV !== 'production' || process.env.NEXT_PUBLIC_E2E_HOOKS === '1') {
    const { installE2EHooks } = await import('./e2e-hooks');
    installE2EHooks(repo, { defaultProfileName: DEFAULT_PROFILE_NAME });
  }
}

/**
 * Makes sure an active profile exists, then (outside production) installs
 * `window.__tytaxE2E`. Renders nothing. `__tytaxE2E.ready` is the e2e signal
 * that the app finished booting.
 */
export function AppBootstrap(): null {
  useEffect(() => {
    booting ??= bootstrap().catch((error: unknown) => {
      booting = null;
      console.error('[tytax] app bootstrap failed', error);
    });
  }, []);
  return null;
}
