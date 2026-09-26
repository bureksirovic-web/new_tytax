'use client';
import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/components/ui';
import type { AccountState } from '@/lib/sync';
import { useAuthT } from '@/lib/auth/use-auth-t';

interface SyncAccountProps {
  account: AccountState;
  /** Where the login page returns to after sign-in. */
  nextPath: string;
  onSignOut(): Promise<void>;
}

/** Signed-in email + sign-out, or a sign-in link. Renders nothing when sync is off. */
export function SyncAccount({ account, nextPath, onSignOut }: SyncAccountProps) {
  const t = useAuthT();
  const [busy, setBusy] = useState(false);

  if (account.status === 'disabled') return null;
  if (account.status === 'loading') {
    return (
      <p data-testid="sync-account" data-status="loading" className="text-sm text-[var(--text-muted)]">
        {t('sync.account.loading')}
      </p>
    );
  }
  if (account.status === 'signed_out') {
    return (
      <div data-testid="sync-account" data-status="signed_out" className="space-y-3">
        <p className="text-sm text-[var(--text-muted)]">{t('sync.account.signed_out')}</p>
        <Link
          data-testid="sync-sign-in"
          href={`/auth/login?next=${encodeURIComponent(nextPath)}`}
          className="inline-flex min-h-[44px] items-center rounded-lg border border-od-green-500 bg-od-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-od-green-500"
        >
          {t('sync.account.sign_in')}
        </Link>
      </div>
    );
  }

  const signOut = async () => {
    setBusy(true);
    try {
      await onSignOut();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div data-testid="sync-account" data-status="signed_in" className="flex flex-wrap items-center justify-between gap-3">
      <p className="min-w-0 text-sm">
        <span className="text-[var(--text-muted)]">{t('sync.account.signed_in_as')}</span>{' '}
        <span data-testid="sync-account-email" className="break-all font-mono text-[var(--text-primary)]">
          {account.email}
        </span>
      </p>
      <Button data-testid="sync-sign-out" variant="secondary" size="sm" loading={busy} onClick={signOut}>
        {t('sync.account.sign_out')}
      </Button>
    </div>
  );
}
