import { createClient } from '@/lib/supabase/client';
import { AuthNotConfiguredError, getSupabaseEnv } from '@/lib/supabase/env';
import { safeNextPath } from './redirect';

export type MagicLinkErrorCode = 'auth_not_configured' | 'invalid_email' | 'send_failed';

export interface MagicLinkResult {
  error: { code: MagicLinkErrorCode; message: string } | null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function fail(code: MagicLinkErrorCode, message: string): MagicLinkResult {
  return { error: { code, message } };
}

/**
 * Origin the magic link points back to: NEXT_PUBLIC_APP_URL if it is a valid
 * http(s) URL, else the browser origin, else null (not configured).
 */
export function getAppOrigin(): string | null {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, '');
  if (configured) {
    try {
      const parsed = new URL(configured);
      if (parsed.protocol === 'https:' || parsed.protocol === 'http:') return configured;
    } catch {
      // fall through to the browser origin
    }
  }
  if (typeof window !== 'undefined' && window.location?.origin && window.location.origin !== 'null') {
    return window.location.origin;
  }
  return null;
}

/** Sends a magic link. Never throws; failures come back as `{ error: { code } }`. */
export async function signInWithMagicLink(email: string, next?: string | null): Promise<MagicLinkResult> {
  const trimmed = typeof email === 'string' ? email.trim() : '';
  if (!EMAIL_RE.test(trimmed)) return fail('invalid_email', 'Invalid email format');

  if (!getSupabaseEnv()) return fail('auth_not_configured', 'Supabase env is not configured');
  const appOrigin = getAppOrigin();
  if (!appOrigin) return fail('auth_not_configured', 'App origin is not configured');

  const emailRedirectTo = `${appOrigin}/auth/callback?next=${encodeURIComponent(safeNextPath(next))}`;

  try {
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: { emailRedirectTo },
    });
    if (error) return fail('send_failed', error.message || 'Failed to send magic link');
    return { error: null };
  } catch (err) {
    if (err instanceof AuthNotConfiguredError) return fail('auth_not_configured', err.message);
    return fail('send_failed', err instanceof Error ? err.message : 'Failed to send magic link');
  }
}

/** Signs out; a no-op when auth is not configured. */
export async function signOut(): Promise<void> {
  if (!getSupabaseEnv()) return;
  const supabase = createClient();
  await supabase.auth.signOut();
}

/** Current session; `{ session: null }` without error when auth is not configured. */
export async function getSession() {
  if (!getSupabaseEnv()) {
    return { data: { session: null }, error: null };
  }
  const supabase = createClient();
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();
  if (error) {
    console.error('getSession error:', error.message);
  }
  return { data: { session }, error };
}
