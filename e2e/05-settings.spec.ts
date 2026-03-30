import { test, expect } from '@playwright/test';

test.describe('Settings Flow', () => {
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

  test('toggles language and theme successfully', async ({ page }) => {
    // 1. Go to /settings
    await page.goto('/settings');

    // Wait for settings to load
    await expect(page.locator('text="Settings"').first()).toBeVisible();

    // 2. Toggle language to HR (Hrvatski)
    const hrRadio = page.locator('input[name="locale"][value="hr"]');
    // We click its parent label
    await hrRadio.locator('..').click();

    // Check if the title text changes to "Postavke"
    await expect(page.locator('text="Postavke"').first()).toBeVisible();

    // Revert back to EN
    const enRadio = page.locator('input[name="locale"][value="en"]');
    await enRadio.locator('..').click();
    await expect(page.locator('text="Settings"').first()).toBeVisible();

    // 3. Toggle theme to OLED
    const oledRadio = page.locator('input[name="theme"][value="oled"]');
    await oledRadio.locator('..').click();

    // Verify the html tag has the correct theme
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'oled');

    // 4. Navigate back to dashboard and ensure theme persists
    await page.goto('/dashboard');
    await expect(page.locator('text="COMMAND CENTER"').first()).toBeVisible();

    // Check theme again
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'oled');
  });
});
