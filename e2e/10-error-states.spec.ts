import { test, expect } from '@playwright/test';

test.describe('Error and Empty States', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
    });
    await page.evaluate(async () => {
      const dbs = await window.indexedDB.databases();
      for (const db of dbs) {
        if (db.name) {
          window.indexedDB.deleteDatabase(db.name);
        }
      }
    });
  });

  test('shows "Exercise not found" for non-existent exercise', async ({ page }) => {
    await page.goto('/exercises/nonexistent-id');

    await expect(page.locator('text="Exercise not found"').first()).toBeVisible({ timeout: 10000 });

    await expect(page.locator('button', { hasText: 'Back to library' }).first()).toBeVisible();
  });

  test('shows empty state on history with no workouts', async ({ page }) => {
    await page.goto('/history');

    await expect(page.locator('text="History"').first()).toBeVisible();

    await expect(page.locator('text="No workouts yet"').first()).toBeVisible();

    await expect(page.locator('text="Complete your first session to see it here."').first()).toBeVisible();
  });

  test('shows preset installation prompt on programs with no programs', async ({ page }) => {
    await page.goto('/programs');

    await expect(page.locator('text="Programs"').first()).toBeVisible();

    await expect(page.locator('text="Browse Presets"').first()).toBeVisible();
  });
});
