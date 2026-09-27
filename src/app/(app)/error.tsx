'use client';
import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { useLocale } from '@/components/providers';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useLocale();
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    console.error(error);
    headingRef.current?.focus();
  }, [error]);

  return (
    <div role="alert" data-testid="error-boundary" className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-4">
      <h1
        ref={headingRef}
        tabIndex={-1}
        className="font-display text-2xl uppercase text-highlight focus:outline-none"
      >
        {t('error_title')}
      </h1>
      <p className="max-w-sm text-center text-sm text-fg-muted">
        {error.message || t('error_unexpected')}
      </p>
      <Button onClick={reset} variant="primary">
        {t('error_try_again')}
      </Button>
    </div>
  );
}
