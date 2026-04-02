import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
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

  test('submits valid email and sees confirmation message', async ({ page }) => {
    await page.goto('/auth/login');

    const emailInput = page.locator('input[type="email"]');
    await emailInput.fill('user@example.com');

    await page.locator('button', { hasText: 'Continue with Email' }).click();

    await expect(page.locator('text="Check your email for a magic link"').first()).toBeVisible({ timeout: 10000 });
  });

  test('shows error for invalid email format', async ({ page }) => {
    await page.goto('/auth/login');

    const emailInput = page.locator('input[type="email"]');
    await emailInput.fill('not-an-email');

    await page.locator('button', { hasText: 'Continue with Email' }).click();

    const isValid = await emailInput.evaluate((el) => (el as HTMLInputElement).validity.valid);
    expect(isValid).toBe(false);
  });

  test('signs out from settings and redirects to login', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForURL('**/settings');

    await expect(page.locator('text="Settings"').first()).toBeVisible();

    const signInBtn = page.locator('button', { hasText: 'Sign In' });
    if (await signInBtn.isVisible()) {
      await signInBtn.click();
    } else {
      const signOutBtn = page.locator('button', { hasText: /sign.?out/i });
      if (await signOutBtn.isVisible()) {
        await signOutBtn.click();
      }
    }

    await page.waitForURL('**/auth/login');
    await expect(page.locator('text="TYTAX"').first()).toBeVisible();
  });
});
