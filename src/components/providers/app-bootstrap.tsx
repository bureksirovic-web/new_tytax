'use client';

import { useEffect, useState } from 'react';
import { getRepository } from '@/lib/db';
import { useAuthT } from '@/lib/auth/use-auth-t';
import { installSyncAdapter } from '@/lib/sync/install';
import type { E2EBootHooks } from './e2e-hooks';
import '@/lib/i18n/packs/g5Auth';

/** First-run profile name. User data (renamed in settings), not a UI string. */
const DEFAULT_PROFILE_NAME = 'Profil 1';

/** One bootstrap per page load; dedupes React Strict Mode's double effect run. */
let booting: Promise<void> | null = null;

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.name === 'Error' ? error.message : `${error.name}: ${error.message}`;
  return String(error);
}

async function bootstrap(): Promise<void> {
  // Idempotent; the providers module already did it. Here it guarantees the
  // ordering even when AppBootstrap is mounted on its own (tests).
  if (process.env.NEXT_PUBLIC_SYNC_ENABLED === 'true') installSyncAdapter();
  const repo = getRepository();
  let hooks: E2EBootHooks | null = null;
  // Inlined at build time: a production build without NEXT_PUBLIC_E2E_HOOKS=1
  // folds this to `false` and drops the e2e-hooks chunk. Installed before
  // ensureActive so a failed boot still exposes `bootError` and `reset()`.
  if (process.env.NODE_ENV !== 'production' || process.env.NEXT_PUBLIC_E2E_HOOKS === '1') {
    const { installBootingE2EHooks } = await import('./e2e-hooks');
    hooks = installBootingE2EHooks(repo, { defaultProfileName: DEFAULT_PROFILE_NAME });
  }
  try {
    await repo.profiles.ensureActive(DEFAULT_PROFILE_NAME);
  } catch (error) {
    if (hooks) hooks.bootError = errorMessage(error);
    throw error;
  }
  if (hooks) hooks.ready = true;
}

/** The shared boot promise; a failed boot clears it so a retry starts over. */
function startBoot(): Promise<void> {
  booting ??= bootstrap().catch((error: unknown) => {
    booting = null;
    console.error('[tytax] app bootstrap failed', error);
    throw error;
  });
  return booting;
}

function BootError({ detail, onRetry }: { detail: string; onRetry: () => void }) {
  const t = useAuthT();
  return (
    <div
      role="alert"
      data-testid="app-boot-error"
      className="fixed inset-x-0 top-0 z-50 m-3 flex flex-col gap-2 rounded-lg border border-red-700 bg-red-950/90 px-4 py-3 text-sm text-red-100"
    >
      <p className="font-display text-base uppercase tracking-wide">{t('app.boot.error_title')}</p>
      <p>{t('app.boot.error_body')}</p>
      <p data-testid="app-boot-error-detail" className="font-mono text-xs text-red-300 break-words">
        {detail}
      </p>
      <button
        type="button"
        data-testid="app-boot-retry"
        onClick={onRetry}
        className="min-h-11 self-start rounded-md border border-red-500 px-4 font-display uppercase tracking-wide hover:bg-red-900/60"
      >
        {t('app.boot.retry')}
      </button>
    </div>
  );
}

/**
 * Makes sure an active profile exists. Outside production it first installs
 * `window.__tytaxE2E` (`ready` flips to true after the boot, `bootError` is set
 * when it fails). Renders nothing unless the boot failed; then it shows the
 * error with a retry button.
 */
export function AppBootstrap() {
  const [failure, setFailure] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    startBoot().then(
      () => {
        if (live) setFailure(null);
      },
      (error: unknown) => {
        if (live) setFailure(errorMessage(error));
      }
    );
    return () => {
      live = false;
    };
  }, [attempt]);

  if (failure === null) return null;
  return (
    <BootError
      detail={failure}
      onRetry={() => {
        setFailure(null);
        setAttempt((n) => n + 1);
      }}
    />
  );
}
