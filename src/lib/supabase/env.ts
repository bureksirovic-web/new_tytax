/**
 * Supabase public configuration. Next.js inlines NEXT_PUBLIC_* only for literal
 * `process.env.NEXT_PUBLIC_X` references, so keep these references literal.
 */

export interface SupabaseEnv {
  url: string;
  anonKey: string;
}

export class AuthNotConfiguredError extends Error {
  readonly code = 'auth_not_configured' as const;

  constructor(message = 'Supabase is not configured: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are required') {
    super(message);
    this.name = 'AuthNotConfiguredError';
  }
}

/** Returns the Supabase URL and anon key, or null if either is missing or blank. */
export function getSupabaseEnv(): SupabaseEnv | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey) return null;
  return { url, anonKey };
}

/**
 * Sync (and with it every browser-side Supabase call) is on only when
 * NEXT_PUBLIC_SYNC_ENABLED is exactly 'true' and the Supabase env is set.
 * Keep the reference literal: Next.js inlines only literal `process.env.NEXT_PUBLIC_*`.
 */
export function isSyncEnabled(): boolean {
  return process.env.NEXT_PUBLIC_SYNC_ENABLED === 'true' && getSupabaseEnv() !== null;
}

/** Like getSupabaseEnv, but throws AuthNotConfiguredError instead of returning null. */
export function requireSupabaseEnv(): SupabaseEnv {
  const env = getSupabaseEnv();
  if (!env) throw new AuthNotConfiguredError();
  return env;
}
