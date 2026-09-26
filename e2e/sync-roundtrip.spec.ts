import { test, expect, createTytax, waitForApp, type Page } from './fixtures';
import {
  adminClient,
  createUser,
  deleteUser,
  magicLinkIn,
  mailIds,
  requireSyncE2EEnv,
  type SyncE2EEnv,
} from './fixtures/supabase';
import { DEFAULT_LOCALE } from '../src/components/providers/locale-core';
import { AUTH_STRINGS } from '../src/lib/auth/i18n';

/**
 * AC12 in the browser: two devices (two browser contexts) sign in to one
 * account through the real magic-link flow (Mailpit → /auth/v1/verify →
 * /auth/callback → /auth/account), and a workout logged on A reaches B.
 * Tagged @sync: the plain e2e job (no Supabase) runs with --grep-invert @sync;
 * the sync-e2e job runs this file, and missing env fails it (never skips).
 */

/**
 * TEMPORARY, remove each when its request is applied (the spec must still pass):
 * - bypassCSP: docs/v2/requests/G5-02.md. next.config.ts (frozen) limits CSP
 *   connect-src to https://*.supabase.co, which blocks the local stack.
 * - serviceWorkers 'block': docs/v2/requests/G5-03.md. public/sw.js (G4)
 *   intercepts and caches cross-origin Supabase GETs.
 */
const DEVICE = { bypassCSP: true, serviceWorkers: 'block' } as const;
test.use(DEVICE);

/** A fresh browser context renders DEFAULT_LOCALE (G4: 'hr'). */
const ui = AUTH_STRINGS[DEFAULT_LOCALE];
const BENCH_ID = 'tytax_smith-machine_smith-flat-bench-press';

/** Magic-link sign-in through the login UI; lands on `next`. */
async function signIn(page: Page, env: SyncE2EEnv, email: string, next: string): Promise<void> {
  const before = new Set(await mailIds(env, email));
  await page.goto(`/auth/login?next=${encodeURIComponent(next)}`);
  await page.locator('#auth-email').fill(email);
  await page.getByRole('button', { name: ui['auth.login.submit'] }).click();
  await expect(page.getByText(ui['auth.login.sent_title'])).toBeVisible();

  let fresh = '';
  await expect
    .poll(async () => {
      fresh = (await mailIds(env, email)).find((id) => !before.has(id)) ?? '';
      return fresh;
    }, { message: 'magic-link email in Mailpit', timeout: 15_000 })
    .not.toBe('');
  await page.goto(await magicLinkIn(env, fresh));
  await expect(page).toHaveURL(new RegExp(`${next.replace(/\//g, '\\/')}$`));
}

/** Clicks Sync now and waits until the run finished clean with nothing pending. */
async function syncAndSettle(page: Page): Promise<void> {
  await page.getByTestId('sync-now').click();
  await expect(page.getByTestId('sync-status')).toHaveAttribute('data-status', 'idle', { timeout: 20_000 });
  await expect(page.getByTestId('sync-pending')).toHaveText('0');
  await expect(page.getByTestId('sync-last-synced')).not.toHaveAttribute('data-value', '');
}

test('a workout logged on device A reaches device B through Supabase', { tag: '@sync' }, async ({ page, browser, baseURL, tytax }) => {
  test.setTimeout(120_000);
  const env = requireSyncE2EEnv();
  const admin = adminClient(env);
  const user = await createUser(admin, 'roundtrip');
  const deviceB = await browser.newContext({ ...DEVICE, baseURL });
  try {
    // Device A: sign in, log a workout, sync.
    await signIn(page, env, user.email, '/auth/account');
    await expect(page.getByTestId('auth-account-heading')).toBeVisible();
    await expect(page.getByTestId('sync-account-email')).toHaveText(user.email);
    await waitForApp(page);
    const { activeProfileId } = await tytax.snapshot();
    expect(activeProfileId).not.toBeNull();
    const [log] = await tytax.seedHistory(activeProfileId as string, [
      { daysAgo: 1, sessionName: 'Synced push day', exercises: [{ exerciseId: BENCH_ID, sets: [{ kg: 60, reps: 8 }, { kg: 65, reps: 6 }] }] },
    ]);
    await syncAndSettle(page);

    const server = await admin.from('workout_logs').select('id, session_name, family_member_id').eq('id', log.id);
    expect(server.error).toBeNull();
    expect(server.data).toEqual([{ id: log.id, session_name: 'Synced push day', family_member_id: activeProfileId }]);

    // Device B: a fresh browser, same account.
    const pageB = await deviceB.newPage();
    const tytaxB = createTytax(pageB);
    await signIn(pageB, env, user.email, '/auth/account');
    await expect(pageB.getByTestId('sync-account-email')).toHaveText(user.email);
    await syncAndSettle(pageB);

    const logsOnB = await tytaxB.listLogs(activeProfileId as string);
    expect(logsOnB.map((l) => ({ id: l.id, name: l.sessionName, sets: l.totalSets }))).toEqual([
      { id: log.id, name: 'Synced push day', sets: 2 },
    ]);
  } finally {
    await deviceB.close();
    await deleteUser(admin, user.id);
  }
});

test('sync on, signed out: the app still works and nothing is sent', { tag: '@sync' }, async ({ page, tytax }) => {
  requireSyncE2EEnv();
  const restCalls: string[] = [];
  const errors: string[] = [];
  page.on('request', (r) => {
    if (r.url().includes('/rest/v1/')) restCalls.push(r.method());
  });
  page.on('pageerror', (e) => errors.push(e.message));

  const res = await page.goto('/dashboard');
  expect(res?.status()).toBe(200);
  await waitForApp(page);
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();

  const { activeProfileId } = await tytax.snapshot();
  await tytax.seedHistory(activeProfileId as string, [
    { daysAgo: 0, exercises: [{ exerciseId: BENCH_ID, sets: [{ kg: 50, reps: 10 }] }] },
  ]);
  expect(await tytax.listLogs(activeProfileId as string)).toHaveLength(1);

  await page.goto('/auth/account');
  await expect(page.getByTestId('auth-account-heading')).toBeVisible();
  await expect(page.getByTestId('sync-account')).toHaveAttribute('data-status', 'signed_out');
  await expect(page.getByTestId('sync-sign-in')).toHaveAttribute('href', '/auth/login?next=%2Fauth%2Faccount');
  await expect(page.getByTestId('sync-now')).toBeDisabled();
  // Queued locally for a later sign-in, never sent.
  await expect(page.getByTestId('sync-pending')).not.toHaveText('0');
  expect(restCalls).toEqual([]);
  expect(errors).toEqual([]);
});
