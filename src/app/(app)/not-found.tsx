'use client';

import { useRouter } from 'next/navigation';

export default function NotFound() {
  const router = useRouter();

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 p-4">
      <h2 className="font-['Oswald'] text-2xl uppercase text-[var(--highlight)]">
        Page not found
      </h2>
      <p className="text-[var(--text-muted)] text-sm text-center max-w-sm">
        The page you are looking for does not exist.
      </p>
      <button
        onClick={() => router.push('/dashboard')}
        className="px-4 py-2 bg-[var(--accent)] text-[var(--text-primary)] rounded-[var(--radius-sm)] text-sm font-medium hover:bg-[var(--accent-hover)] transition-colors"
      >
        Back to Dashboard
      </button>
    </div>
  );
}
