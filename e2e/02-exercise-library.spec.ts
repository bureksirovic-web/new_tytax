import { test, expect } from '@playwright/test';

test.describe('Exercise Library', () => {
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
    await page.goto('/exercises');
  });

  test('loads exercises, searches, filters, and views details', async ({ page }) => {
    // Wait for the library to load (should see some exercise cards)
    await expect(page.locator('text="Exercise Library"').first()).toBeVisible();

    // Look for text matching X result or results
    await expect(page.locator('text=/\\d+ results?/i').first()).toBeVisible();

    // Search for "squat"
    const searchInput = page.locator('input[placeholder*="Search"]');
    await searchInput.fill('squat');
    // Wait for debounced search (300ms)
    await page.waitForTimeout(500);

    // Test a modality filter
    await page.locator('button', { hasText: 'Bodyweight' }).click();
    await page.waitForTimeout(100);

    // Click the first exercise card (which is a button)
    // We expect the first button that looks like an exercise card to navigate
    const firstExerciseCard = page.locator('button').filter({ hasText: 'BW' }).first();
    await firstExerciseCard.click();

    // Check if we navigated to the exercise details page
    await page.waitForURL('**/exercises/**');

    // The details page should show "Muscle Impact" and "Back"
    await expect(page.locator('text="Muscle Impact"').first()).toBeVisible();
    await expect(page.locator('button', { hasText: 'Back' }).first()).toBeVisible();
  });
});
