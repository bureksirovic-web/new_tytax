'use client';
import { useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button, Input } from '@/components/ui';
import { signInWithMagicLink } from '@/lib/auth/helpers';
import { safeNextPath } from '@/lib/auth/redirect';
import { useAuthT } from '@/lib/auth/use-auth-t';
import { getSupabaseEnv } from '@/lib/supabase/env';
import { AuthAlert } from './auth-alert';

export function LoginForm() {
  const t = useAuthT();
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next');
  const notConfigured = getSupabaseEnv() === null;

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [errorCode, setErrorCode] = useState<string | null>(() => searchParams.get('error'));

  // Not configured: <NotConfiguredAlert /> (outside Suspense) already shows the banner.
  const shownError = notConfigured ? null : errorCode;
  const disabled = notConfigured || loading;

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (disabled || !email.trim()) return;
    setLoading(true);
    setErrorCode(null);
    try {
      const { error } = await signInWithMagicLink(email.trim(), next);
      if (error) setErrorCode(error.code);
      else setSent(true);
    } catch {
      setErrorCode('send_failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {shownError && <AuthAlert code={shownError} />}

      {sent ? (
        <div className="text-center space-y-4" role="status">
          <p className="text-sm font-medium text-[var(--text-primary)]">{t('auth.login.sent_title')}</p>
          <p className="text-xs text-[var(--text-muted)]">{t('auth.login.sent_body')}</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4" aria-busy={loading}>
          <Input
            id="auth-email"
            label={t('auth.login.email_label')}
            type="email"
            name="email"
            autoComplete="email"
            placeholder={t('auth.login.email_placeholder')}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={notConfigured}
            required
            autoFocus
          />
          <Button type="submit" fullWidth loading={loading} disabled={disabled || !email.trim()}>
            {t('auth.login.submit')}
          </Button>
        </form>
      )}

      {!sent && (
        <div className="text-center">
          <button
            type="button"
            onClick={() => router.push(safeNextPath(next))}
            className="min-h-[44px] text-xs underline underline-offset-2 cursor-pointer text-[var(--text-muted)]"
          >
            {t('auth.login.continue_without_account')} &rarr;
          </button>
        </div>
      )}
    </>
  );
}
