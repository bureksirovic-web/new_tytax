'use client';
import { useLocale } from '@/components/providers';

export const MAIN_CONTENT_ID = 'main-content';

/** First focusable element on every app page: jumps past the navigation. */
export function SkipLink() {
  const { t } = useLocale();
  return (
    <a
      href={`#${MAIN_CONTENT_ID}`}
      className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[60] focus:flex focus:min-h-11 focus:items-center focus:rounded-lg focus:bg-highlight focus:px-4 focus:text-sm focus:font-semibold focus:text-gunmetal-950 focus:outline-2 focus:outline-offset-2 focus:outline-fg"
    >
      {t('layout_skip_to_content')}
    </a>
  );
}
