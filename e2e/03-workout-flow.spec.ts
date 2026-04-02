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

    // 2. Click "START WORKOUT" button
    await page.locator('button', { hasText: 'START WORKOUT' }).click();

    // 3. Navigate to /workout/active
    await page.waitForURL('**/workout/active');

    // Wait for the page to settle
    await page.waitForTimeout(500);

    const noExercisesText = page.locator('text="No exercises in this session."');
    if (await noExercisesText.isVisible()) {
      await page.evaluate(() => {
        // @ts-expect-error Playwright types for page.evaluate - access window for testing
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
                   reps: 0,
                   done: false,
                   timestamp: new Date().toISOString()
                 }
               ],
               restSeconds: 60
             }
           ];
           // @ts-expect-error Playwright types for page.evaluate
           window.useWorkoutStore.setState({ exercises: [...store.exercises], state: 'active' });
        }
      });
      // Ensure state updates in the DOM by waiting
      await page.waitForTimeout(500);
    }

    // Now we should see the exercise logging UI
    await expect(page.locator('text="LOG SET"').first()).toBeVisible({ timeout: 10000 });

    // Enter weight and reps
    const incWeightBtn = page.locator('button[aria-label="Increase by 2.5"]');
    await incWeightBtn.click(); // 2.5

    const incRepsBtn = page.locator('button[aria-label="Increase by 1"]');
    await incRepsBtn.click(); // 11

    // Click "LOG SET" button
    await page.locator('button', { hasText: 'LOG SET' }).first().click();

    // Set appears in "completed sets" list (look for "Set 1")
    await expect(page.locator('text="Set 1"').first()).toBeVisible();

    // Click "FINISH"
    await page.locator('button', { hasText: 'FINISH' }).first().click();

    // Navigates to /workout/debrief
    await page.waitForURL('**/workout/debrief');

    // Debrief shows volume/stats
    await expect(page.locator('text="DEBRIEF"')).toBeVisible();
    await expect(page.locator('text="VOLUME"')).toBeVisible();

    // Click "SAVE & EXIT"
    await page.locator('button', { hasText: 'SAVE & EXIT' }).click();

    // Navigates to /dashboard
    await page.waitForURL('**/dashboard');
    await expect(page.locator('text="COMMAND CENTER"').first()).toBeVisible();
  });
});
