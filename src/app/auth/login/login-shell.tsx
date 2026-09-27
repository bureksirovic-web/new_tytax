'use client';
import type { ReactNode } from 'react';
import { useAuthT } from '@/lib/auth/use-auth-t';

/** Card frame + heading for the login screen; rendered outside the Suspense boundary. */
export function LoginShell({ children }: { children: ReactNode }) {
  const t = useAuthT();
  return (
    <main className="min-h-screen flex items-center justify-center px-4 bg-[var(--bg-primary)]">
      <div className="w-full max-w-sm rounded-xl border p-8 space-y-6 bg-[var(--bg-secondary)] border-[var(--border-color)]">
        <div className="text-center space-y-1">
          <h1
            data-testid="auth-login-heading"
            className="text-3xl font-semibold tracking-widest uppercase font-['Oswald'] text-[var(--text-primary)]"
          >
            {t('auth.login.title')}
          </h1>
          <p className="text-xs uppercase tracking-wider text-[var(--text-muted)]">
            {t('auth.login.subtitle')}
          </p>
        </div>
        {children}
      </div>
    </main>
  );
}
