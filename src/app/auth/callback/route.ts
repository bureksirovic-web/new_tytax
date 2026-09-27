import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { AuthNotConfiguredError, getSupabaseEnv } from '@/lib/supabase/env';
import { safeNextPath } from '@/lib/auth/redirect';

type Outcome =
  | 'ok'
  | 'provider_error'
  | 'auth_not_configured'
  | 'missing_code'
  | 'auth_exchange_failed';

const PROVIDER_CODE_RE = /^[a-z_]{1,40}$/;

/** Supabase sends error, error_code, error_description; only a strict code survives. */
function sanitizeProviderCode(params: URLSearchParams): string {
  const raw = params.get('error_code') || params.get('error') || '';
  return PROVIDER_CODE_RE.test(raw) ? raw : 'auth_failed';
}

/**
 * A relative Location: the browser resolves it against the URL it requested, so
 * the redirect always stays on the public origin. `request.url` is the
 * server's own view (dev reports `localhost` for 127.0.0.1; behind a hosting
 * proxy it can be the internal host), which would drop the session cookie.
 * `path` is always ours or safeNextPath() output: one leading '/', never '//'.
 * Logs status + request id + our own outcome label; never the code, token or query.
 */
function redirect(requestId: string, path: string, outcome: Outcome) {
  const response = new NextResponse(null, { status: 307, headers: { Location: path } });
  const line = JSON.stringify({ route: '/auth/callback', status: response.status, outcome, requestId });
  if (outcome === 'ok') console.info(line);
  else console.warn(line);
  return response;
}

function loginWithError(requestId: string, code: string, outcome: Outcome) {
  return redirect(requestId, `/auth/login?error=${code}`, outcome);
}

export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const params = new URL(request.url).searchParams;

  if (params.has('error') || params.has('error_code')) {
    return loginWithError(requestId, sanitizeProviderCode(params), 'provider_error');
  }

  if (!getSupabaseEnv()) {
    return loginWithError(requestId, 'auth_not_configured', 'auth_not_configured');
  }

  const code = params.get('code');
  if (!code) {
    return loginWithError(requestId, 'missing_code', 'missing_code');
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return loginWithError(requestId, 'auth_exchange_failed', 'auth_exchange_failed');
    }
  } catch (err) {
    if (err instanceof AuthNotConfiguredError) {
      return loginWithError(requestId, 'auth_not_configured', 'auth_not_configured');
    }
    return loginWithError(requestId, 'auth_exchange_failed', 'auth_exchange_failed');
  }

  return redirect(requestId, safeNextPath(params.get('next')), 'ok');
}
