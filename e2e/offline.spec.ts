import { test, expect } from './fixtures';

import type { Page } from 'playwright-core';

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

test.describe.configure({ mode: 'serial' });

test('a workout can be logged while offline', async ({ page, context, tytax }) => {
  test.setTimeout(180_000);
  await tytax.gotoApp('/dashboard');
  await tytax.reset();
  await primeOffline(page, tytax.gotoApp);

  await context.setOffline(true);
  await page.goto('/workout');
  await expect(page.getByTestId('start-quick-workout')).toBeVisible();

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

  await context.setOffline(false);
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

  await context.setOffline(true);
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
  await context.setOffline(false);
});

test('an uncached route offline falls back to the offline page', async ({ page, context, tytax }) => {
  test.setTimeout(120_000);
  await tytax.gotoApp('/dashboard');
  await primeOffline(page, tytax.gotoApp);

  await context.setOffline(true);
  await page.goto('/this-route-was-never-cached');
  await expect(page.locator('h1')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'hr');
  await expect(page.getByRole('link', { name: /Početna/ })).toHaveAttribute('href', '/dashboard');
  await context.setOffline(false);
});
