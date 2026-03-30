'use client';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 p-4">
      <h2 className="font-['Oswald'] text-2xl uppercase text-[var(--highlight)]">
        Something went wrong
      </h2>
      <p className="text-[var(--text-muted)] text-sm text-center max-w-sm">
        {error.message || 'An unexpected error occurred.'}
      </p>
      <Button onClick={reset} variant="primary">Try again</Button>
    </div>
  );
}
