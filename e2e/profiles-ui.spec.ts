import { test, expect } from './fixtures';

/**
 * AC9 (UI part): family profiles are created, switched and deleted from the
 * Settings screen; each profile sees only its own history, and deleting one
 * leaves the other intact.
 */

const BENCH_ID = 'tytax_smith-machine_smith-flat-bench-press';

test('create, switch and delete profiles from settings; data stays isolated', async ({ page, tytax }) => {
  await tytax.gotoApp('/settings');
  await tytax.reset();
  const ana = await tytax.seedProfile({ name: 'Ana' });
  await tytax.seedHistory(ana.id, [
    { daysAgo: 1, sessionName: 'Ana Upper', exercises: [{ exerciseId: BENCH_ID, sets: [{ kg: 40, reps: 10 }] }] },
  ]);

  // Create a second profile through the UI.
  await tytax.gotoApp('/settings');
  await expect(page.getByTestId('page-heading-settings')).toBeVisible();
  const rows = page.locator('[data-testid^="settings-profile-row-"]');
  await expect(rows.filter({ hasText: 'Ana' })).toHaveCount(1);
  // App start may already have created a default profile besides the seeded one.
  const before = await rows.count();
  await page.getByTestId('settings-profile-name-input').fill('Marko');
  await page.getByTestId('settings-profile-create').click();

  // One more row: Marko, created above.
  await expect(rows).toHaveCount(before + 1);
  const markoRow = rows.filter({ hasText: 'Marko' });
  const markoId = (await markoRow.getAttribute('data-testid'))!.replace('settings-profile-row-', '');
  expect(markoId).not.toBe(ana.id);

  // Switch to Marko: his history is empty.
  await page.getByTestId(`settings-profile-switch-${markoId}`).click();
  await expect.poll(async () => (await tytax.snapshot()).activeProfileId).toBe(markoId);
  await tytax.gotoApp('/history');
  await expect(page.getByTestId('page-heading-history')).toBeVisible();
  await expect(page.getByTestId('history-item')).toHaveCount(0);

  // Switch back to Ana: her workout is there.
  await tytax.gotoApp('/settings');
  await page.getByTestId(`settings-profile-switch-${ana.id}`).click();
  await expect.poll(async () => (await tytax.snapshot()).activeProfileId).toBe(ana.id);
  await tytax.gotoApp('/history');
  await expect(page.getByTestId('history-item')).toHaveCount(1);
  await expect(page.getByTestId('history-item')).toContainText('Ana Upper');

  // Delete Marko (type-to-confirm): Ana and her log survive.
  await tytax.gotoApp('/settings');
  await page.getByTestId(`settings-profile-delete-${markoId}`).click();
  await page.getByTestId('settings-profile-delete-confirm-input').fill('Marko');
  await page.getByTestId('settings-profile-delete-confirm').click();
  // Back to the count before Marko existed; Ana is still listed.
  await expect(rows).toHaveCount(before);
  await expect(rows.filter({ hasText: 'Marko' })).toHaveCount(0);
  await expect(rows.filter({ hasText: 'Ana' })).toHaveCount(1);
  expect((await tytax.snapshot()).activeProfileId).toBe(ana.id);
  // 1: deleting Marko did not touch Ana's workout.
  expect(await tytax.listLogs(ana.id)).toHaveLength(1);
});

test('the language switch applies immediately and persists', async ({ page, tytax }) => {
  await tytax.gotoApp('/settings');
  await tytax.reset();
  await tytax.seedProfile({ name: 'Ana' });
  await tytax.gotoApp('/settings');

  const heading = page.getByTestId('page-heading-settings');
  await expect(heading).toHaveText(/postavke/i);
  await page.getByTestId('settings-language-select').selectOption('en');
  await expect(heading).toHaveText(/settings/i);

  await page.reload();
  await expect(page.getByTestId('page-heading-settings')).toHaveText(/settings/i);
});

test('units switch to lb changes displayed weights', async ({ page, tytax }) => {
  await tytax.gotoApp('/history');
  await tytax.reset();
  const ana = await tytax.seedProfile({ name: 'Ana', settings: { units: 'lb' } });
  await tytax.seedHistory(ana.id, [
    { daysAgo: 1, exercises: [{ exerciseId: BENCH_ID, sets: [{ kg: 100, reps: 5 }] }] },
  ]);
  const [log] = await tytax.listLogs(ana.id);

  await tytax.gotoApp(`/history/${log.id}`);
  // 100 kg × 2.20462 = 220.462 → displayed 220.5 lb.
  await expect(page.getByText(/220[.,]5\s*lb/).first()).toBeVisible();
  await expect(page.getByText(/\b100\s*kg/)).toHaveCount(0);
  expect(log.exercises[0].sets[0].kg).toBe(100);
});
