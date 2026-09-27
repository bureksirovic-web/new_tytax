'use client';
import Link from 'next/link';
import { useT } from '@/lib/i18n/use-t';
import '@/lib/i18n/packs/history';

/** Unknown, deleted or foreign log id. */
export function HistoryNotFound({ testId = 'page-heading-history-detail' }: { testId?: string }) {
  const { t } = useT();
  return (
    <div data-testid="history-not-found" className="mx-auto flex max-w-md flex-col items-center gap-4 p-4 pt-20 text-center">
      <h1 data-testid={testId} className="font-display text-xl font-bold uppercase tracking-wider text-fg">
        {t('hist_not_found')}
      </h1>
      <p className="text-sm text-fg-muted">{t('hist_not_found_desc')}</p>
      <Link
        href="/history"
        className="flex min-h-11 items-center rounded-lg border border-line bg-card px-4 text-sm font-medium text-fg hover:bg-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-highlight"
      >
        {t('hist_back')}
      </Link>
    </div>
  );
}

export function HistoryDetailLoading() {
  const { t } = useT();
  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4" aria-busy="true">
      <p role="status" className="sr-only">
        {t('hist_loading')}
      </p>
      <div className="h-10 w-48 animate-pulse rounded bg-card" />
      <div className="h-24 w-full animate-pulse rounded-xl bg-card" />
      <div className="h-40 w-full animate-pulse rounded-xl bg-card" />
    </div>
  );
}
