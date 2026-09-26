import { test, expect } from './fixtures';
import { serverHasSupabase } from './fixtures/env';
import { adminClient, createUser, deleteUser, magicLinkIn, mailIds, requireSyncE2EEnv } from './fixtures/supabase';
import { DEFAULT_LOCALE } from '../src/components/providers/locale-core';
import { AUTH_STRINGS } from '../src/lib/auth/i18n';

/**
 * /auth/callback error handling (GOALS G5 §2, PLAN §7 open redirect).
 *
 * Runs in both CI jobs: the plain e2e job (no Supabase env) and sync-e2e
 * (local Supabase). playwright.config.ts pins the server's Supabase env to the
 * runner's, so serverHasSupabase() tells which branch the callback takes:
 * - provider `?error=` is handled before the env check: same redirect in both;
 * - without Supabase every other path answers `auth_not_configured`, and the
 *   login page shows only the not-configured banner (it hides `?error=`).
 * The callback answers with a relative Location, so the hop is checked raw
 * (maxRedirects: 0) and the landed page against baseURL.
 */

const configured = serverHasSupabase();
const DESCRIPTION = 'leaked-description-7c1e';
/** A fresh browser context renders DEFAULT_LOCALE (G4: 'hr'). */
const ui = AUTH_STRINGS[DEFAULT_LOCALE];
const alertText = (code: keyof typeof ui) => ui[code];

test('provider error lands on login with the code only, never the description', async ({ page, baseURL }) => {
  const path = `/auth/callback?error=access_denied&error_description=${DESCRIPTION}`;

  const hop = await page.request.get(path, { maxRedirects: 0 });
  expect(hop.status()).toBe(307);
  expect(hop.headers()['location']).toBe('/auth/login?error=access_denied');

  await page.goto(path);
  await expect(page).toHaveURL(`${baseURL}/auth/login?error=access_denied`);
  expect(page.url()).not.toContain(DESCRIPTION);

  const alert = page.getByTestId('auth-error');
  await expect(alert).toHaveCount(1);
  await expect(alert).toBeVisible();
  await expect(alert).toHaveText(
    alertText(configured ? 'auth.error.access_denied' : 'auth.error.auth_not_configured')
  );
});

test('callback without a code lands on login with a deterministic error', async ({ page, baseURL }) => {
  const expected = configured ? 'missing_code' : 'auth_not_configured';

  const hop = await page.request.get('/auth/callback', { maxRedirects: 0 });
  expect(hop.status()).toBe(307);
  expect(hop.headers()['location']).toBe(`/auth/login?error=${expected}`);

  await page.goto('/auth/callback');
  await expect(page).toHaveURL(`${baseURL}/auth/login?error=${expected}`);
  const alert = page.getByTestId('auth-error');
  await expect(alert).toHaveCount(1);
  await expect(alert).toHaveText(alertText(`auth.error.${expected}`));
});

test('a failed exchange with next=//evil.com lands on login on this origin (error path; the success path is the next describe)', async ({ page, baseURL }) => {
  const expected = configured ? 'auth_exchange_failed' : 'auth_not_configured';
  const path = '/auth/callback?code=x&next=//evil.com';

  const hop = await page.request.get(path, { maxRedirects: 0 });
  expect(hop.status()).toBe(307);
  // Relative Location: the browser resolves it against the origin it asked.
  expect(hop.headers()['location']).toBe(`/auth/login?error=${expected}`);

  await page.goto(path);
  const landed = new URL(page.url());
  expect(landed.origin).toBe(new URL(baseURL ?? '').origin);
  expect(landed.pathname).toBe('/auth/login');
  expect(page.url()).not.toContain('evil.com');
  await expect(page.getByTestId('auth-error')).toHaveText(alertText(`auth.error.${expected}`));
});

/**
 * Open redirect on the SUCCESS path: a real magic link whose redirect_to is
 * rewritten to /auth/callback?next=//evil.com. The code exchange succeeds, so
 * only safeNextPath() stands between the user and evil.com. Needs the local
 * Supabase (sync-e2e job); missing env fails, never skips.
 */
test.describe('open redirect after a successful sign-in', () => {
  // TEMPORARY (same as e2e/sync-roundtrip.spec.ts): requests G5-02 (CSP) and G5-03 (service worker).
  test.use({ bypassCSP: true, serviceWorkers: 'block' });

  test('next=//evil.com on a successful exchange lands on /dashboard on this origin', { tag: '@sync' }, async ({ page, baseURL }) => {
    test.setTimeout(60_000);
    const env = requireSyncE2EEnv();
    const admin = adminClient(env);
    const user = await createUser(admin, 'redirect');
    try {
      const before = new Set(await mailIds(env, user.email));
      await page.goto('/auth/login?next=%2Fauth%2Faccount');
      await page.locator('#auth-email').fill(user.email);
      await page.getByRole('button', { name: ui['auth.login.submit'] }).click();
      await expect(page.getByText(ui['auth.login.sent_title'])).toBeVisible();
      let id = '';
      await expect
        .poll(async () => {
          id = (await mailIds(env, user.email)).find((m) => !before.has(m)) ?? '';
          return id;
        }, { message: 'magic-link email in Mailpit', timeout: 15_000 })
        .not.toBe('');

      const origin = new URL(baseURL ?? '').origin;
      const link = new URL(await magicLinkIn(env, id));
      link.searchParams.set('redirect_to', `${origin}/auth/callback?next=//evil.com`);

      const hops: Array<{ status: number; location: string | undefined }> = [];
      page.on('response', (r) => {
        if (new URL(r.url()).pathname === '/auth/callback') hops.push({ status: r.status(), location: r.headers()['location'] });
      });
      await page.goto(link.toString());
      await expect(page).toHaveURL(`${origin}/dashboard`);

      // The exchange succeeded (a failure would land on /auth/login?error=…) and
      // the callback answered with our own default path, never the attacker's.
      expect(hops).toEqual([{ status: 307, location: '/dashboard' }]);
      expect(page.url()).not.toContain('evil.com');
      const cookies = await page.context().cookies(origin);
      expect(cookies.some((c) => /^sb-.+-auth-token/.test(c.name))).toBe(true);
    } finally {
      await deleteUser(admin, user.id);
    }
  });
});
