'use client';
import Link from 'next/link';
import { Skeleton } from '@/components/ui/skeleton';
import type { TranslationKey } from '@/lib/i18n';
import { useT } from '@/lib/i18n/use-t';

/** Loading placeholder for program routes (announced, no endless spinner: `missing` replaces it). */
export function LoadingState() {
  const { t } = useT();
  return (
    <div role="status" aria-live="polite" className="mx-auto max-w-2xl space-y-3 px-4 py-6">
      <span className="sr-only">{t('prog_loading')}</span>
      <Skeleton className="h-10 w-2/3" />
      <Skeleton className="h-24" />
      <Skeleton className="h-24" />
    </div>
  );
}

/** Not-found state for a program id that does not exist, is deleted, or belongs to another profile. */
export function NotFoundState({
  titleKey = 'prog_detail_not_found',
  testId = 'page-heading-program-detail',
  backHref = '/programs',
}: {
  titleKey?: TranslationKey;
  testId?: string;
  backHref?: string;
}) {
  const { t } = useT();
  return (
    <div className="mx-auto max-w-2xl px-4 py-12 text-center" data-testid="program-not-found">
      <h1 data-testid={testId} className="font-display text-2xl font-bold text-highlight">
        {t(titleKey)}
      </h1>
      <p className="mt-2 text-sm text-fg-muted">{t('prog_detail_not_found_desc')}</p>
      <Link
        href={backHref}
        className="mt-6 inline-flex min-h-11 items-center rounded-lg border border-line bg-bg-2 px-4 text-sm text-fg hover:bg-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        {t('prog_detail_back')}
      </Link>
    </div>
  );
}
