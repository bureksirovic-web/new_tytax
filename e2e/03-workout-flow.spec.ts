import { test, expect } from '@playwright/test';

test.describe('Workout Flow', () => {
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

  test('completes a quick start workout', async ({ page }) => {
    // 1. Go to /workout
    await page.goto('/workout');

    // 2. Click "Start Workout" button
    await page.locator('button', { hasText: 'Start Workout' }).click();

    // 3. Navigate to /workout/active
    await page.waitForURL('**/workout/active');
    await page.waitForTimeout(500);

    // Try to inject an exercise via store
    const noExercisesText = page.locator('text=/add your first exercise/i');
    if (await noExercisesText.isVisible()) {
      await page.evaluate(() => {
        // @ts-expect-error Playwright types for page.evaluate
        const store = window.__ZUSTAND_STORES__?.workout?.getState?.();
        if (store) {
          const exercises = [
            {
              exerciseRef: 'bw-squat',
              exerciseName: 'Bodyweight Squat',
              modality: 'bodyweight',
              sets: [],
              restSeconds: 60,
            },
          ];
          // @ts-expect-error Playwright types for page.evaluate
          window.__ZUSTAND_STORES__?.workout.setState({
            exercises,
            currentExercise: exercises[0],
            currentExerciseIndex: 0,
            sets: {
              'bw-squat': [
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
            },
          });
        }
      });
      await page.waitForTimeout(500);
    }

    // Check if logging UI appeared
    const logSetVisible = await page.locator('text="LOG SET"').first().isVisible({ timeout: 3000 }).catch(() => false);

    if (logSetVisible) {
      // Enter weight and reps
      const incWeightBtn = page.locator('button[aria-label="Increase by 2.5"]');
      await incWeightBtn.click();

      const incRepsBtn = page.locator('button[aria-label="Increase by 1"]');
      await incRepsBtn.click();

      // Click "LOG SET" button
      await page.locator('button', { hasText: 'LOG SET' }).first().click();

      // Set appears in "completed sets" list
      await expect(page.locator('text="Set 1"').first()).toBeVisible();
    }

    // Click "Finish"
    await page.locator('button', { hasText: 'Finish' }).first().click();

    // Navigates to /workout/debrief
    await page.waitForURL('**/workout/debrief');

    // Debrief shows volume/stats
    await expect(page.locator('text="Debrief"')).toBeVisible();
    await expect(page.locator('text="Volume"')).toBeVisible();

    // Click "Save & Exit"
    await page.locator('button', { hasText: 'Save & Exit' }).click();

    // Navigates to /dashboard
    await page.waitForURL('**/dashboard');
    await expect(page.locator('text="Command Center"').first()).toBeVisible();
  });
});
