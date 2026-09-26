'use client';
import Link from 'next/link';
import { useLocale } from '@/components/providers';

export default function NotFound() {
  const { t } = useLocale();

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-4">
      <h1 className="font-display text-2xl uppercase text-highlight">{t('error_not_found_title')}</h1>
      <p className="max-w-sm text-center text-sm text-fg-muted">{t('error_not_found_desc')}</p>
      <Link
        href="/dashboard"
        className="inline-flex min-h-11 items-center rounded-sm border border-od-green-500 bg-od-green-600 px-4 text-sm font-medium text-white transition-colors hover:bg-od-green-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-highlight"
      >
        {t('error_back_to_dashboard')}
      </Link>
    </div>
  );
}
