import { test, expect } from '@playwright/test';

test.describe('Analytics Flow', () => {
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

  test('loads analytics page and verifies charts render', async ({ page }) => {
    await page.goto('/analytics');

    await expect(page.locator('text="Analytics"').first()).toBeVisible();

    await expect(page.locator('text="Training Load — ACWR"').first()).toBeVisible();

    await expect(page.locator('text="Weekly Volume"').first()).toBeVisible();

    await expect(page.locator('text="Kinetic Impact Score"').first()).toBeVisible();
  });

  test('navigates to per-exercise analytics from best lifts', async ({ page }) => {
    await page.goto('/analytics');

    await expect(page.locator('text="Analytics"').first()).toBeVisible();

    const bestLiftsLink = page.locator('a[href^="/analytics/"]').first();
    const hasBestLifts = await bestLiftsLink.count() > 0;

    if (hasBestLifts) {
      await bestLiftsLink.click();
      await page.waitForURL('**/analytics/**');
      await expect(page.locator('text="← Analytics"').first()).toBeVisible();
    } else {
      const noLiftsText = page.locator('text="No lifts logged yet."');
      await expect(noLiftsText.first()).toBeVisible();
    }
  });
});
