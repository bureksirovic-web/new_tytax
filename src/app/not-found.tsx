'use client';
import Link from 'next/link';
import { useLocale } from '@/components/providers';

export default function NotFound() {
  const { t } = useLocale();

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-bg p-4 text-fg">
      <h1 className="mb-2 font-display text-2xl uppercase text-highlight">
        <span aria-hidden="true">404</span>
        <span className="sr-only">{t('error_not_found_title')}</span>
      </h1>
      <p className="mb-6 max-w-sm text-center text-sm text-fg-2">{t('error_not_found_desc')}</p>
      <Link
        href="/dashboard"
        className="inline-flex min-h-11 items-center rounded-sm border border-od-green-500 bg-od-green-600 px-4 text-sm font-medium text-white transition-colors hover:bg-od-green-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-highlight"
      >
        {t('error_back_to_dashboard')}
      </Link>
    </main>
  );
}
