'use client';
import Link from 'next/link';
import { SyncPanel } from '@/components/sync/sync-panel';
import { useAuthT } from '@/lib/auth/use-auth-t';
import '@/lib/i18n/packs/g5Auth';

export function AccountView() {
  const t = useAuthT();
  return (
    <main className="flex min-h-screen justify-center bg-[var(--bg-primary)] px-4 py-10">
      <div className="w-full max-w-md space-y-6">
        <h1
          data-testid="auth-account-heading"
          className="font-['Oswald'] text-2xl font-semibold uppercase tracking-widest text-[var(--text-primary)]"
        >
          {t('auth.account.title')}
        </h1>
        <SyncPanel nextPath="/auth/account" />
        <Link
          href="/dashboard"
          className="inline-flex min-h-[44px] items-center text-sm text-[var(--text-muted)] underline underline-offset-2"
        >
          {t('auth.account.back')}
        </Link>
      </div>
    </main>
  );
}
