import { test, expect } from '@playwright/test';

test.describe('History Flow', () => {
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

  test('loads history page and shows empty state', async ({ page }) => {
    await page.goto('/history');

    await expect(page.locator('text="History"').first()).toBeVisible();

    await expect(page.locator('text="No workouts yet"').first()).toBeVisible();
  });

  test('creates a workout and verifies it appears in history', async ({ page }) => {
    await page.goto('/workout');

    await page.locator('button', { hasText: 'START WORKOUT' }).click();

    await page.waitForURL('**/workout/active');
    await page.waitForTimeout(500);

    const noExercisesText = page.locator('text="No exercises in this session."');
    if (await noExercisesText.isVisible()) {
      await page.evaluate(() => {
        // @ts-expect-error Playwright types for page.evaluate
        const store = window.useWorkoutStore?.getState?.();
        if (store) {
          store.exercises = [
            {
              exerciseRef: 'bw-squat',
              exerciseName: 'Bodyweight Squat',
              modality: 'bodyweight',
              sets: [
                {
                  id: '1',
                  setNumber: 1,
                  type: 'working',
                  kg: 0,
                  reps: 10,
                  done: false,
                  timestamp: new Date().toISOString(),
                },
              ],
              restSeconds: 60,
            },
          ];
          // @ts-expect-error Playwright types for page.evaluate
          window.useWorkoutStore.setState({ exercises: [...store.exercises], state: 'active' });
        }
      });
      await page.waitForTimeout(500);
    }

    await expect(page.locator('text="LOG SET"').first()).toBeVisible({ timeout: 10000 });

    const incRepsBtn = page.locator('button[aria-label="Increase by 1"]');
    await incRepsBtn.click();

    await page.locator('button', { hasText: 'LOG SET' }).first().click();

    await expect(page.locator('text="Set 1"').first()).toBeVisible();

    await page.locator('button', { hasText: 'FINISH' }).first().click();

    await page.waitForURL('**/workout/debrief');

    await expect(page.locator('text="DEBRIEF"')).toBeVisible();

    await page.locator('button', { hasText: 'SAVE & EXIT' }).click();

    await page.waitForURL('**/dashboard');

    await page.goto('/history');

    await expect(page.locator('text="History"').first()).toBeVisible();

    await expect(page.locator('text="1 session"').first()).toBeVisible();

    const firstWorkoutCard = page.locator('a[href^="/history/"]').first();
    await expect(firstWorkoutCard).toBeVisible();

    await firstWorkoutCard.click();

    await page.waitForURL('**/history/**');

    await expect(page.locator('text="Bodyweight Squat"').first()).toBeVisible();

    await expect(page.locator('text="Volume"').first()).toBeVisible();
    await expect(page.locator('text="Sets"').first()).toBeVisible();
    await expect(page.locator('text="Exercises"').first()).toBeVisible();
  });
});
