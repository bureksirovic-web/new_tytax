import { test, expect } from '@playwright/test';

test.describe('Programs Flow', () => {
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

  test('installs and activates a preset program', async ({ page }) => {
    await page.goto('/programs');

    // Check page header
    await expect(page.locator('text="Programs"').first()).toBeVisible();

    // The section "Browse Presets" should be visible
    await expect(page.locator('text="Browse Presets"')).toBeVisible();

    // Find the first preset and click "Install"
    await page.locator('button', { hasText: 'Install' }).first().click();

    // Installing navigates to `/programs/[id]`
    await page.waitForURL('**/programs/**');

    // Go back to programs list
    await page.goto('/programs');

    // Check "My Programs" section
    await expect(page.locator('text="My Programs"')).toBeVisible();

    // Now under "My Programs", find the installed program and click "Activate"
    const activateBtn = page.locator('button', { hasText: 'Activate' }).first();
    await activateBtn.click();

    // The program should now be active, badge shows "ACTIVE"
    await expect(page.locator('text="ACTIVE"').first()).toBeVisible();

    // The button might change to "Active" (disabled)
    await expect(page.locator('button', { hasText: 'Active' }).first()).toBeDisabled();
  });
});
