// Next 16 file convention: `proxy.ts` (formerly `middleware.ts`), named export `proxy`, Node.js runtime.
import { createServerClient } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';
import { getSupabaseEnv } from '@/lib/supabase/env';

/** Only sync uses the session, so the refresh runs only when sync is on. */
function syncEnabled(): boolean {
  return process.env.NEXT_PUBLIC_SYNC_ENABLED === 'true';
}

/**
 * Refreshes the Supabase session cookie before a page renders (the @supabase/ssr
 * pattern). Local-first: when Supabase is not configured or sync is off it
 * returns `NextResponse.next()` without any network call. It never throws; a
 * Supabase failure lets the request through unauthenticated.
 */
export async function proxy(request: NextRequest): Promise<NextResponse> {
  const env = getSupabaseEnv();
  if (!env || !syncEnabled()) return NextResponse.next();

  let response = NextResponse.next({ request });

  try {
    const supabase = createServerClient(env.url, env.anonKey, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          // Update the request so server components see the refreshed session,
          // then rebuild the response from it and copy the cookies onto it.
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    });
    // getUser() validates the token with the auth server and triggers the refresh.
    await supabase.auth.getUser();
  } catch {
    // Supabase unreachable or misconfigured: proceed without a session.
  }

  return response;
}

/**
 * Skips static assets, the service worker and its Workbox chunks, the manifest,
 * icons, the offline page and the health probe. Must stay a literal: Next
 * analyses it at build time.
 */
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|api/health(?:/|$)|favicon\\.ico$|manifest\\.json$|manifest\\.webmanifest$|sw\\.js$|sw\\.js\\.map$|workbox-[^/]*\\.js(?:\\.map)?$|swe-worker-[^/]*\\.js$|offline\\.html$|icons/|.*\\.(?:png|jpg|jpeg|gif|svg|webp|avif|ico|txt|xml|woff2?)$).*)',
  ],
};
