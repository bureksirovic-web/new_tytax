'use client';
import { authErrorKey } from '@/lib/auth/i18n';
import { useAuthT } from '@/lib/auth/use-auth-t';
import { getSupabaseEnv } from '@/lib/supabase/env';

/** Error banner for an auth error code; unknown codes render auth.error.auth_failed. */
export function AuthAlert({ code }: { code: string }) {
  const t = useAuthT();
  return (
    <div
      role="alert"
      data-testid="auth-error"
      className="rounded-lg border px-3 py-2 text-sm border-red-700 bg-red-950/30 text-red-200"
    >
      {t(authErrorKey(code))}
    </div>
  );
}

/**
 * The "accounts not available" banner. It does not depend on search params, so
 * it lives outside the Suspense boundary and is part of the prerendered HTML.
 * NEXT_PUBLIC_* values are inlined at build, so server and client agree.
 */
export function NotConfiguredAlert() {
  return getSupabaseEnv() === null ? <AuthAlert code="auth_not_configured" /> : null;
}
