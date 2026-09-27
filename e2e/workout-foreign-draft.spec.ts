import { test, expect } from './fixtures';

/**
 * R04: the workout draft belongs to the profile that started it. After the
 * active profile changes, /workout, /workout/active and /workout/debrief
 * name the owner and offer switching back or discarding; nothing is added to
 * or saved as the new profile.
 *
 * The profile switch uses `tytax.seedProfile` (it activates the new profile
 * through the app's repository), the same effect as settings' switch (G4).
 */

test('a draft started on profile A is not continued or saved as profile B; switching back resumes it', async ({ page, tytax }) => {
  await tytax.gotoApp('/workout');
  await tytax.reset();
  const ana = await tytax.seedProfile({ name: 'Ana' });

  await tytax.gotoApp('/workout');
  await page.getByTestId('start-quick-workout').click();
  await expect(page).toHaveURL(/\/workout\/active$/);
  await expect(page.getByTestId('active-workout')).toBeVisible();
  const started = await tytax.snapshot();
  expect(started.draft?.profileId).toBe(ana.id);

  const bo = await tytax.seedProfile({ name: 'Bo' });
  expect((await tytax.snapshot()).activeProfileId).toBe(bo.id);

  await tytax.gotoApp('/workout');
  await expect(page.getByTestId('foreign-draft-title')).toHaveText(/Ana/);
  await expect(page.getByTestId('continue-workout')).toHaveCount(0);
  await expect(page.getByTestId('start-quick-workout')).toHaveCount(0);

  await tytax.gotoApp('/workout/active');
  await expect(page.getByTestId('foreign-draft-screen')).toBeVisible();
  await expect(page.getByTestId('add-exercise-button')).toHaveCount(0);

  await tytax.gotoApp('/workout/debrief');
  await expect(page.getByTestId('foreign-draft-screen')).toBeVisible();
  await expect(page.getByTestId('save-workout')).toHaveCount(0);

  await page.getByTestId('foreign-draft-switch').click();
  await expect(page.getByTestId('foreign-draft-screen')).toHaveCount(0);
  await expect(page.getByTestId('workout-debrief')).toBeVisible();
  const after = await tytax.snapshot();
  expect(after.activeProfileId).toBe(ana.id);
  expect(after.draft?.id).toBe(started.draft?.id);
  expect(await tytax.listLogs(bo.id)).toHaveLength(0);
});

test('a foreign draft is discarded only after a confirm, and B can then start its own workout', async ({ page, tytax }) => {
  await tytax.gotoApp('/workout');
  await tytax.reset();
  const ana = await tytax.seedProfile({ name: 'Ana' });
  await tytax.gotoApp('/workout');
  await page.getByTestId('start-quick-workout').click();
  await expect(page).toHaveURL(/\/workout\/active$/);
  const bo = await tytax.seedProfile({ name: 'Bo' });

  await tytax.gotoApp('/workout');
  await expect(page.getByTestId('foreign-draft')).toBeVisible();
  await page.getByTestId('discard-workout').click();
  await expect(page.getByTestId('discard-confirm-dialog')).toBeVisible();
  await page.getByTestId('discard-cancel').click();
  await expect(page.getByTestId('foreign-draft')).toBeVisible();
  expect((await tytax.snapshot()).draft?.profileId).toBe(ana.id);

  await page.getByTestId('discard-workout').click();
  await page.getByTestId('discard-confirm').click();
  await expect(page.getByTestId('foreign-draft')).toHaveCount(0);
  await expect(page.getByTestId('start-quick-workout')).toBeEnabled();
  const snap = await tytax.snapshot();
  expect(snap.draft).toBeNull();
  expect(snap.activeProfileId).toBe(bo.id);
  expect(await tytax.listLogs(ana.id)).toHaveLength(0);

  await page.getByTestId('start-quick-workout').click();
  await expect(page).toHaveURL(/\/workout\/active$/);
  await expect(page.getByTestId('active-workout')).toBeVisible();
  expect((await tytax.snapshot()).draft?.profileId).toBe(bo.id);
});
