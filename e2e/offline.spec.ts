import { test, expect } from './fixtures';

import type { BrowserContext, Page } from 'playwright-core';

/**
 * AC15 / AC18: after one online visit the service worker has precached the
 * shell routes, their chunks and every catalog chunk. Offline, a whole workout
 * can be logged, and an exercise from a catalog chunk the user never opened
 * (bodyweight) can be added after an offline reload.
 */

const BENCH_ID = 'tytax_smith-machine_smith-flat-bench-press';
const PUSHUP_ID = 'bw_push_wall-push-up';

async function primeOffline(page: Page, gotoApp: (p: string) => Promise<void>): Promise<void> {
  await gotoApp('/dashboard');
  // Set by src/components/layout/service-worker.tsx once the worker is active,
  // every catalog chunk is loaded and the worker has cached the shell.
  await expect(page.locator('html')).toHaveAttribute('data-sw-ready', '1', { timeout: 90_000 });
  const controlled = await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready;
    return reg.active?.state === 'activated';
  });
  expect(controlled).toBe(true);
}

/**
 * Offline for the page and for the worker's own fetches: `setOffline` alone
 * let worker-initiated fetches reach the server (see the restore test).
 */
async function goOffline(context: BrowserContext): Promise<void> {
  await context.route('**/*', (route) => route.abort('internetdisconnected'));
  await context.setOffline(true);
}

async function goOnline(context: BrowserContext): Promise<void> {
  await context.setOffline(false);
  await context.unrouteAll();
}

test.describe.configure({ mode: 'serial' });
// playwright.config.ts blocks service workers by default; this spec is about the worker.
test.use({ serviceWorkers: 'allow' });

// `next dev` never hydrates a page that was loaded offline (its HMR client waits
// for the dev socket), so this spec is only meaningful against a production
// build: NEXT_PUBLIC_E2E_HOOKS=1 npm run build && E2E_SERVER=prod PORT=… npx playwright test e2e/offline.spec.ts
// (docs/v2/requests/G4-03). Fail loudly instead of skipping.
test.beforeEach(() => {
  expect(process.env.E2E_SERVER, 'offline.spec needs E2E_SERVER=prod (see docs/v2/requests/G4-03)').toBe('prod');
});

test('a workout can be logged while offline', async ({ page, context, tytax }) => {
  test.setTimeout(180_000);
  await tytax.gotoApp('/dashboard');
  await tytax.reset();
  await primeOffline(page, tytax.gotoApp);

  await goOffline(context);
  await page.goto('/workout');
  // Offline first paint in dev can take a while: chunks come from the SW cache.
  await expect(page.getByTestId('start-quick-workout')).toBeVisible({ timeout: 30_000 });

  await page.getByTestId('start-quick-workout').click();
  await expect(page).toHaveURL(/\/workout\/active/);
  await page.getByTestId('add-exercise-button').click();
  await page.getByTestId('exercise-search').fill('Smith Flat Bench');
  await page.locator(`[data-testid="exercise-option"][data-exercise-id="${BENCH_ID}"]`).click();

  const row = page.getByTestId('set-row').first();
  await row.getByTestId('set-kg').fill('50');
  await row.getByTestId('set-reps').fill('10');
  await row.getByTestId('set-rir').fill('2');
  await row.getByTestId('set-done').click();
  await expect(row.getByTestId('set-done')).toHaveAttribute('aria-pressed', 'true');

  await page.getByTestId('finish-workout').click();
  await expect(page).toHaveURL(/\/workout\/debrief/);
  await page.getByTestId('save-workout').click();
  await expect(page).toHaveURL(/\/history/);
  await expect(page.getByTestId('history-item')).toHaveCount(1);

  await goOnline(context);
  const { activeProfileId } = await tytax.snapshot();
  const logs = await tytax.listLogs(activeProfileId!);
  // 1: the workout logged offline is in IndexedDB.
  expect(logs).toHaveLength(1);
  // 50 × 10 = 500 kg over the one done working set.
  expect(logs[0].totalVolumeKg).toBe(500);
});

test('an offline reload can use a catalog chunk never opened before', async ({ page, context, tytax }) => {
  test.setTimeout(180_000);
  await tytax.gotoApp('/dashboard');
  await tytax.reset();
  await primeOffline(page, tytax.gotoApp);

  await goOffline(context);
  await page.goto('/workout');
  await page.reload();
  await page.getByTestId('start-quick-workout').click();
  await page.getByTestId('add-exercise-button').click();
  await page.getByTestId('exercise-search').fill('Wall Push');

  const option = page.locator(`[data-testid="exercise-option"][data-exercise-id="${PUSHUP_ID}"]`);
  await expect(option).toBeVisible({ timeout: 15_000 });
  await option.click();
  await expect(page.getByTestId('session-exercise')).toHaveCount(1);
  await expect(page.getByTestId('session-exercise')).toContainText(/push/i);
  await goOnline(context);
});

test('an uncached route offline falls back to the offline page', async ({ page, context, tytax }) => {
  test.setTimeout(120_000);
  await tytax.gotoApp('/dashboard');
  await primeOffline(page, tytax.gotoApp);

  await goOffline(context);
  await page.goto('/this-route-was-never-cached');
  await expect(page.locator('h1')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'hr');
  await expect(page.getByRole('link', { name: /Početna/ })).toHaveAttribute('href', '/dashboard');
  await goOnline(context);
});

// The English dictionary is a lazy chunk (src/lib/i18n/index.ts) that an hr
// session never fetches. After one online visit in hr the worker must still
// have it (it follows the chunk references in the loader code), so switching
// the language offline works. (Setting localStorage 'locale' is not enough:
// the active profile's language wins at boot, see ProfilePrefsSync.)
test('switching to English works offline although English was never used online', async ({ page, context, tytax }) => {
  test.setTimeout(120_000);
  await tytax.gotoApp('/dashboard');
  await tytax.reset();
  await primeOffline(page, tytax.gotoApp);
  await expect(page.locator('html')).toHaveAttribute('lang', 'hr');

  await goOffline(context);
  await page.goto('/settings');
  const heading = page.getByTestId('page-heading-settings');
  await expect(heading).toHaveText(/postavke/i, { timeout: 30_000 });
  await page.getByTestId('settings-language-select').selectOption('en');
  await expect(heading).toHaveText(/settings/i);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  // An offline reload keeps English: the profile says en, the chunk is cached.
  await page.reload();
  await expect(page.getByTestId('page-heading-settings')).toHaveText(/settings/i, { timeout: 30_000 });
  await goOnline(context);
});

// Integration (v2-g3/v2-g4 merge log): restore loads G2's backup service and
// the BackupV3 row validator lazily (zod stays out of first-load JS), so those
// chunks are never referenced by a page's HTML. After one online visit they
// must still be available offline, although Settings was never opened online.
// `setOffline` alone let fetches made by the worker itself reach the server in
// this setup (a chunk never cached still loaded), so goOffline also aborts
// the network with context.route, which in Chromium routes worker requests too.
test('a backup can be restored while offline', async ({ page, context, tytax }) => {
  test.setTimeout(180_000);
  await tytax.gotoApp('/dashboard');
  await tytax.reset();
  await primeOffline(page, tytax.gotoApp);

  // Settings was never opened online: everything below runs offline, on a fresh load.
  await goOffline(context);
  await page.goto('/settings');
  const downloadButton = page.getByTestId('settings-backup-download');
  await expect(downloadButton).toBeEnabled({ timeout: 30_000 });
  const [download] = await Promise.all([page.waitForEvent('download'), downloadButton.click()]);
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(chunk as Buffer);
  const backup = Buffer.concat(chunks);
  expect(JSON.parse(backup.toString('utf8')).format).toBe('tytax-backup');

  const input = page.getByTestId('settings-restore-input');
  await input.setInputFiles({ name: 'tytax-backup.json', mimeType: 'application/json', buffer: backup });
  await expect(page.getByTestId('settings-restore-preview')).toBeVisible({ timeout: 15_000 });
  await page.getByTestId('settings-restore-ack').check();
  await page.getByTestId('settings-restore-confirm').click();
  await expect(page.getByText(/Kopija vraćena/)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId('settings-restore-failed')).toHaveCount(0);
  await goOnline(context);
});
