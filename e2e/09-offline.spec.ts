import { test, expect } from '@playwright/test';

test.describe('Offline Behavior', () => {
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

  test('shows offline indicator and saves workout locally', async ({ page, context }) => {
    await page.goto('/dashboard');
    await page.waitForURL('**/dashboard');

    await context.setOffline(true);

    await expect(page.locator('text=/offline/i').first()).toBeVisible({ timeout: 5000 });

    await page.goto('/workout');

    await page.locator('button', { hasText: 'Start Workout' }).click();

    await page.waitForURL('**/workout/active');
    await page.waitForTimeout(500);

    const noExercisesText = page.locator('text=/add your first exercise/i');
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

    await page.locator('button', { hasText: 'Finish' }).first().click();

    await page.waitForURL('**/workout/debrief');

    await expect(page.locator('text="Debrief"')).toBeVisible();

    await page.locator('button', { hasText: 'Save & Exit' }).click();

    await page.waitForURL('**/dashboard');

    const workoutCount = await page.evaluate(async () => {
      const dbs = await window.indexedDB.databases();
      const db = dbs.find((d: { name?: string }) => d.name?.includes('dexie') || d.name?.includes('tytax'));
      if (!db) return 0;
      const openReq = indexedDB.open(db.name!);
      return new Promise<number>((resolve) => {
        openReq.onsuccess = () => {
          const tx = openReq.result.transaction('workoutLogs', 'readonly');
          const store = tx.objectStore('workoutLogs');
          const countReq = store.count();
          countReq.onsuccess = () => resolve(countReq.result);
        };
      });
    });
    expect(workoutCount).toBeGreaterThanOrEqual(1);

    await context.setOffline(false);

    await expect(page.locator('text="OFFLINE"')).not.toBeVisible({ timeout: 5000 });
  });
});
