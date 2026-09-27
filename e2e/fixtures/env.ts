/**
 * What the e2e web server was started with. playwright.config.ts pins the
 * server's NEXT_PUBLIC_SUPABASE_* to the runner's process.env (empty when
 * unset), so this mirrors getSupabaseEnv() in src/lib/supabase/env.ts exactly.
 * The plain e2e job runs without Supabase; the sync-e2e job exports it.
 */
export function serverHasSupabase(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  return Boolean(url && key);
}
