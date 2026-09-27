/**
 * Local-Supabase helpers for the sync/auth e2e specs (run by the CI
 * `sync-e2e` job). Missing env fails the test with instructions; nothing skips.
 * Never logs keys, tokens or links.
 */
import { expect, type Page } from '@playwright/test';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const HOW_TO =
  'Sync e2e needs the local Supabase env. In the repo root:\n' +
  '  eval "$(npx -y supabase@2.118.0 status -o env | sed \'s/^/export /\')"\n' +
  '  export NEXT_PUBLIC_SUPABASE_URL=$API_URL NEXT_PUBLIC_SUPABASE_ANON_KEY=$ANON_KEY SUPABASE_SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY NEXT_PUBLIC_SYNC_ENABLED=true\n' +
  '  PORT=3105 npx playwright test e2e/sync-*.spec.ts --project=chromium';

export interface SyncE2EEnv {
  url: string;
  serviceKey: string;
  mailpitUrl: string;
}

export function requireSyncE2EEnv(): SyncE2EEnv {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? '';
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? '';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? '';
  const flag = process.env.NEXT_PUBLIC_SYNC_ENABLED;
  const missing = [
    !url && 'NEXT_PUBLIC_SUPABASE_URL',
    !anon && 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    !serviceKey && 'SUPABASE_SERVICE_ROLE_KEY',
    flag !== 'true' && 'NEXT_PUBLIC_SYNC_ENABLED=true',
  ].filter(Boolean);
  if (missing.length > 0) throw new Error(`Missing env: ${missing.join(', ')}.\n${HOW_TO}`);
  const mailpitUrl = (process.env.MAILPIT_URL || process.env.INBUCKET_URL || 'http://127.0.0.1:54424').replace(/\/+$/, '');
  return { url, serviceKey, mailpitUrl };
}

export function adminClient(env: SyncE2EEnv): SupabaseClient {
  return createClient(env.url, env.serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** A confirmed user with a unique address; delete it with `deleteUser` when done. */
export async function createUser(admin: SupabaseClient, label: string): Promise<{ id: string; email: string }> {
  const email = `e2e-${label}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}@tytax.test`;
  const { data, error } = await admin.auth.admin.createUser({ email, email_confirm: true });
  if (error || !data.user) throw new Error(`admin.createUser failed: ${error?.status ?? '?'} ${error?.code ?? ''}`);
  return { id: data.user.id, email };
}

export async function deleteUser(admin: SupabaseClient, id: string): Promise<void> {
  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) throw new Error(`admin.deleteUser failed: ${error.status ?? '?'} ${error.code ?? ''}`);
}

interface MailpitSummary {
  ID: string;
}

/** IDs of every Mailpit message sent to `email`, newest first. */
export async function mailIds(env: SyncE2EEnv, email: string): Promise<string[]> {
  const res = await fetch(`${env.mailpitUrl}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`);
  if (!res.ok) throw new Error(`Mailpit search answered ${res.status}`);
  const body = (await res.json()) as { messages?: MailpitSummary[] };
  return (body.messages ?? []).map((m) => m.ID);
}

/** The Supabase verify link in a Mailpit message. */
export async function magicLinkIn(env: SyncE2EEnv, id: string): Promise<string> {
  const res = await fetch(`${env.mailpitUrl}/api/v1/message/${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error(`Mailpit message answered ${res.status}`);
  const body = (await res.json()) as { Text?: string; HTML?: string };
  const text = `${body.Text ?? ''}\n${(body.HTML ?? '').replace(/&amp;/g, '&')}`;
  const link = text.match(/https?:\/\/[^\s"'<>]+\/auth\/v1\/verify\?[^\s"'<>)]+/)?.[0];
  if (!link) throw new Error('no /auth/v1/verify link in the Mailpit message');
  return link;
}

/**
 * Types `email` into the magic-link form and waits until the form has taken it.
 * A fill that lands before hydration stays in the DOM but not in React state,
 * so the submit button stays disabled (seen in the full parallel run after the
 * v2-g5 merge: 120 s timeout on a disabled "Nastavi s e-mailom"). Retries the
 * fill until the button is enabled.
 */
export async function fillLoginEmail(page: Page, email: string, submitName: string): Promise<void> {
  const submit = page.getByRole('button', { name: submitName });
  await expect(async () => {
    await page.locator('#auth-email').fill(email);
    await expect(submit).toBeEnabled({ timeout: 1_000 });
  }).toPass({ timeout: 30_000 });
}
