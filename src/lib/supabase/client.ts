import { createBrowserClient } from '@supabase/ssr';
import { requireSupabaseEnv } from './env';

/** Browser Supabase client. Throws AuthNotConfiguredError when env is missing. */
export function createClient() {
  const { url, anonKey } = requireSupabaseEnv();
  return createBrowserClient(url, anonKey);
}
