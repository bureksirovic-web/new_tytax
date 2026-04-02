import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
    });
    // Clear Dexie databases
    await page.evaluate(async () => {
      const dbs = await window.indexedDB.databases();
      for (const db of dbs) {
        if (db.name) {
          window.indexedDB.deleteDatabase(db.name);
        }
      }
    });
  });

  test('main routes load correctly', async ({ page }) => {
    // 1. / redirects to /dashboard
    await page.goto('/');
    await page.waitForURL('**/dashboard');
    await expect(page.locator('text="Command Center"').first()).toBeVisible();

    // 2. /workout
    await page.goto('/workout');
    await expect(page.locator('text="Training Ops"').first()).toBeVisible();

    // 3. /exercises
    await page.goto('/exercises');
    // Check for the exercise library title or search bar placeholder
    await expect(page.locator('text="Exercise Library"').first()).toBeVisible();

    // 4. /programs
    await page.goto('/programs');
    await expect(page.locator('text="Programs"').first()).toBeVisible();

    // 5. /analytics
    await page.goto('/analytics');
    await expect(page.locator('text="Analytics"').first()).toBeVisible();

    // 6. /history
    await page.goto('/history');
    await expect(page.locator('text="History"').first()).toBeVisible();

    // 7. /settings
    await page.goto('/settings');
    await expect(page.locator('text="Settings"').first()).toBeVisible();
  });
});
