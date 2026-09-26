'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Session } from '@supabase/supabase-js';
import { getSession, signOut } from '@/lib/auth/helpers';
import { Button } from '@/components/ui';
import { useLocale } from '@/components/providers';
import { Section, SectionTitle } from './settings-section';

/** Supabase account (sync). Signed-out is the normal local-only state. */
export function AccountSection() {
  const { t } = useLocale();
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    let cancelled = false;
    getSession()
      .then((result) => {
        if (!cancelled) setSession(result.data.session ?? null);
      })
      .catch(() => {
        // No Supabase configured or offline: stay signed out.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSignOut() {
    try {
      await signOut();
    } finally {
      setSession(null);
    }
  }

  return (
    <Section testId="settings-account">
      <SectionTitle>{t('account')}</SectionTitle>
      {session ? (
        <div className="space-y-2">
          <p className="text-sm text-[var(--text-secondary)]">
            {t('signed_in_as')} {session.user.email}
          </p>
          <Button variant="secondary" size="sm" onClick={() => void handleSignOut()}>
            {t('sign_out')}
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-[var(--text-muted)]">{t('sign_in_sync')}</p>
          <Button variant="secondary" size="sm" onClick={() => router.push('/auth/login')}>
            {t('sign_in')}
          </Button>
        </div>
      )}
    </Section>
  );
}
