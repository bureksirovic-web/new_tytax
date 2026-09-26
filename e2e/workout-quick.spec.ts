import { test, expect } from './fixtures';

/**
 * AC3: fresh profile → quick workout → exercise via picker search → three
 * logged sets (kg/reps/RIR/done) → reload keeps everything → finish →
 * debrief (RPE quick button + notes) → history and the stored log agree.
 */

const SQUAT_ID = 'tytax_smith-machine_smith-back-squat';
const SQUAT_NAME = 'Smith Back Squat';

const SETS = [
  { kg: '80', reps: '8', rir: '3' },
  { kg: '85', reps: '6', rir: '2' },
  { kg: '87.5', reps: '5', rir: '1' },
] as const;

test('quick workout logs three sets, survives a reload and is saved with its debrief', async ({ page, tytax }) => {
  await tytax.gotoApp('/workout');
  await tytax.reset();

  await expect(page.getByTestId('workout-home')).toBeVisible();
  await page.getByTestId('start-quick-workout').click();
  await expect(page).toHaveURL(/\/workout\/active$/);
  await expect(page.getByTestId('active-workout')).toBeVisible();

  await page.getByTestId('add-exercise-button').click();
  await expect(page.getByTestId('exercise-picker')).toBeVisible();
  await page.getByTestId('exercise-search').fill('smith back squat');
  await page.locator(`[data-testid="exercise-option"][data-exercise-id="${SQUAT_ID}"]`).click();
  await expect(page.getByTestId('exercise-picker')).toHaveCount(0);

  const card = page.locator(`[data-testid="session-exercise"][data-exercise-id="${SQUAT_ID}"]`);
  await expect(card).toHaveCount(1);
  await expect(card.getByTestId('exercise-name')).toHaveText(SQUAT_NAME);
  const rows = card.getByTestId('set-row');
  // 3: a first-ever exercise gets min(defaultSets 3, 3) empty working sets and no warm-ups.
  await expect(rows).toHaveCount(3);

  for (const [i, entry] of SETS.entries()) {
    const row = rows.nth(i);
    await expect(row.getByTestId('set-done')).toBeDisabled();
    await row.getByTestId('set-kg').fill(entry.kg);
    await row.getByTestId('set-reps').fill(entry.reps);
    await row.getByTestId('set-rir').fill(entry.rir);
    await row.getByTestId('set-done').click();
    await expect(row).toHaveAttribute('data-done', 'true');
  }

  // Mid-workout reload: the persisted draft restores every value.
  await page.reload();
  await expect(page.getByTestId('active-workout')).toBeVisible();
  await expect(rows).toHaveCount(3);
  for (const [i, entry] of SETS.entries()) {
    const row = rows.nth(i);
    await expect(row.getByTestId('set-kg')).toHaveValue(entry.kg);
    await expect(row.getByTestId('set-reps')).toHaveValue(entry.reps);
    await expect(row.getByTestId('set-rir')).toHaveValue(entry.rir);
    await expect(row).toHaveAttribute('data-done', 'true');
    await expect(row).toHaveAttribute('data-set-type', 'working');
  }

  await page.getByTestId('finish-workout').click();
  await expect(page).toHaveURL(/\/workout\/debrief$/);
  await expect(page.getByTestId('workout-debrief')).toBeVisible();
  await page.getByTestId('debrief-rpe-9').click();
  await expect(page.getByTestId('debrief-rpe-9')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('debrief-rpe')).toHaveValue('9');
  await page.getByTestId('debrief-notes').fill('Synthetic e2e note');
  await page.getByTestId('save-workout').click();

  // First-ever exercise: its records are baselines, so no celebration.
  await expect(page).toHaveURL(/\/history$/);
  await expect(page.getByTestId('pr-celebration')).toHaveCount(0);
  const items = page.getByTestId('history-item');
  await expect(items).toHaveCount(1);
  await expect(items).toContainText(SQUAT_NAME);
  // '3': three done working sets.
  await expect(items.getByTestId('history-item-sets')).toHaveText('3');

  const { activeProfileId, draft } = await tytax.snapshot();
  expect(draft).toBeNull();
  expect(activeProfileId).toEqual(expect.any(String));
  const logs = await tytax.listLogs(activeProfileId!);
  expect(logs).toHaveLength(1);
  const [log] = logs;
  expect(log.rpe).toBe(9);
  expect(log.notes).toBe('Synthetic e2e note');
  expect(log.totalSets).toBe(3);
  // 80×8 + 85×6 + 87.5×5 = 640 + 510 + 437.5 = 1587.5 kg.
  expect(log.totalVolumeKg).toBe(1587.5);
  expect(log.prCount).toBe(0);
  expect(log.exercises.map((e) => e.exerciseId)).toEqual([SQUAT_ID]);
  expect(log.exercises[0].sets.map((s) => [s.type, s.kg, s.reps, s.rir, s.done])).toEqual([
    ['working', 80, 8, 3, true],
    ['working', 85, 6, 2, true],
    ['working', 87.5, 5, 1, true],
  ]);
});
