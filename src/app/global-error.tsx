'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { DEFAULT_LOCALE, readStoredLocale, t, type Locale } from '@/lib/i18n';
import './globals.css';

// global-error replaces the root layout, so no providers exist here: the
// locale is read straight from storage. The server snapshot is the default
// locale so the hydration pass always matches.
const noopSubscribe = () => () => {};

function getClientLocale(): Locale {
  try {
    return readStoredLocale(window.localStorage);
  } catch {
    return DEFAULT_LOCALE;
  }
}

const getServerLocale = (): Locale => DEFAULT_LOCALE;

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const locale = useSyncExternalStore(noopSubscribe, getClientLocale, getServerLocale);

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang={locale}>
      <body className="m-0 flex min-h-dvh flex-col items-center justify-center bg-gunmetal-900 p-4 font-sans text-gunmetal-50">
        <main role="alert" data-testid="error-boundary" className="flex flex-col items-center">
          <h1 className="mb-2 font-display text-2xl uppercase text-tactical-amber-300">
            {t('error_title', locale)}
          </h1>
          <p className="mb-2 max-w-sm text-center text-sm text-gunmetal-300">
            {error.message || t('error_unexpected', locale)}
          </p>
          {error.digest && (
            <p className="mb-6 font-mono text-xs text-gunmetal-300">
              {t('error_digest', locale, { digest: error.digest })}
            </p>
          )}
          <button
            type="button"
            onClick={reset}
            className="min-h-11 cursor-pointer rounded-sm border border-od-green-500 bg-od-green-600 px-4 text-sm font-medium text-white hover:bg-od-green-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tactical-amber-300"
          >
            {t('error_try_again', locale)}
          </button>
        </main>
      </body>
    </html>
  );
}
