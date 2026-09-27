import { test, expect, type Page } from './fixtures';


/** AC11 interactions: plate and 1RM calculators, the rest timer, the swap sheet. */

const BENCH_ID = 'tytax_smith-machine_smith-flat-bench-press';
const BENCH_NAME = 'Smith Flat Bench Press';

async function quickWorkoutWithBench(page: Page) {
  await page.getByTestId('start-quick-workout').click();
  await expect(page).toHaveURL(/\/workout\/active$/);
  await page.getByTestId('add-exercise-button').click();
  await page.getByTestId('exercise-search').fill('Smith Flat Bench');
  await page.locator(`[data-testid="exercise-option"][data-exercise-id="${BENCH_ID}"]`).click();
  const card = page.getByTestId('session-exercise');
  await expect(card).toHaveCount(1);
  return card;
}

test('plate calculator: 100 kg on a 20 kg bar is 25 + 15 per side', async ({ page, tytax }) => {
  await tytax.gotoApp('/tools/plate-calculator');
  await tytax.reset();
  await tytax.gotoApp('/tools/plate-calculator');

  await page.getByTestId('plate-bar-input').fill('20');
  await page.getByTestId('plate-target-input').fill('100');
  const plates = page.getByTestId('plate-per-side').getByTestId('plate-item');
  // (100 − 20) / 2 = 40 per side = 25 + 15 with the default plate set.
  await expect(plates).toHaveText(['25', '15']);
  await expect(page.getByTestId('plate-loaded-total')).toContainText('100');
  await expect(page.getByTestId('plate-remainder')).toHaveCount(0);

  await page.getByTestId('plate-target-input').fill('60');
  // (60 − 20) / 2 = 20 per side.
  await expect(plates).toHaveText(['20']);
});

test('1RM calculator: 100 kg × 5 estimates 112.5 kg', async ({ page, tytax }) => {
  await tytax.gotoApp('/tools/rm-calculator');
  await page.getByTestId('rm-weight-input').fill('100');
  await page.getByTestId('rm-reps-input').fill('5');
  // Brzycki: 100 × 36 / (37 − 5) = 112.5.
  await expect(page.getByTestId('rm-result')).toHaveText('112.5');
  await expect(page.getByTestId('rm-unreliable-hint')).toHaveCount(0);

  await page.getByTestId('rm-reps-input').fill('1');
  await expect(page.getByTestId('rm-result')).toHaveText('100');
});

test('1RM calculator warns above 12 reps and still shows the estimate', async ({ page, tytax }) => {
  await tytax.gotoApp('/tools/rm-calculator');
  await page.getByTestId('rm-weight-input').fill('100');
  await page.getByTestId('rm-reps-input').fill('15');
  // Brzycki: 100 × 36 / (37 − 15) = 163.64 → 163.5 (0.5 kg rounding).
  await expect(page.getByTestId('rm-result')).toHaveText('163.5');
  await expect(page.getByTestId('rm-warning')).toBeVisible();
  await expect(page.getByTestId('rm-unreliable-hint')).toBeVisible();

  await page.getByTestId('rm-reps-input').fill('5');
  await expect(page.getByTestId('rm-result')).toHaveText('112.5');
  await expect(page.getByTestId('rm-warning')).toHaveCount(0);
});

test('rest timer starts at the profile default, takes +30 s and counts down', async ({ page, tytax }) => {
  await page.clock.install({ time: new Date('2026-09-20T10:00:00Z') });
  await tytax.gotoApp('/workout');
  await tytax.reset();
  await tytax.gotoApp('/workout');
  const card = await quickWorkoutWithBench(page);

  const row = card.getByTestId('set-row').first();
  await row.getByTestId('set-kg').fill('60');
  await row.getByTestId('set-reps').fill('8');
  await expect(page.getByTestId('rest-timer')).toHaveCount(0);

  // Freeze time so the displayed value is exact.
  await page.clock.pauseAt(new Date('2026-09-20T11:00:00Z'));
  await row.getByTestId('set-done').click();

  const remaining = page.getByTestId('rest-timer-remaining');
  await expect(page.getByTestId('rest-timer')).toBeVisible();
  // 90 s: the profile default (settings.restSeconds); the exercise names none.
  await expect(remaining).toHaveText('1:30');
  await expect(page.getByTestId('rest-timer-progress')).toHaveAttribute('aria-valuenow', '0');

  await page.getByTestId('rest-timer-add30').click();
  await expect(remaining).toHaveText('2:00');

  await page.clock.runFor(20_000);
  await expect(remaining).toHaveText('1:40');
  // 20 of 120 s elapsed.
  await expect(page.getByTestId('rest-timer-progress')).toHaveAttribute('aria-valuenow', '17');

  await page.getByTestId('rest-timer-stop').click();
  await expect(page.getByTestId('rest-timer')).toHaveCount(0);
});

test('swap: picking a suggestion replaces the exercise on the card', async ({ page, tytax }) => {
  await tytax.gotoApp('/workout');
  await tytax.reset();
  await tytax.gotoApp('/workout');
  const card = await quickWorkoutWithBench(page);
  const uid = await card.getAttribute('data-uid');
  expect(uid).toEqual(expect.any(String));

  await card.getByTestId('swap-exercise').click();
  const sheet = page.getByTestId('swap-sheet');
  await expect(sheet).toBeVisible();
  const option = sheet.getByTestId('swap-option').first();
  await expect(option).toBeVisible();
  const pickedId = await option.getAttribute('data-exercise-id');
  expect(pickedId).toEqual(expect.any(String));
  expect(pickedId).not.toBe(BENCH_ID);
  // Ranked by muscle overlap: the top alternative to a bench press trains the chest too.
  await expect(option).toHaveAttribute('data-muscle-group', 'CHEST');
  const pickedName = await option.locator('span').first().textContent();
  expect(pickedName).toEqual(expect.any(String));
  expect(pickedName!.length).toBeGreaterThan(0);
  await option.click();

  await expect(sheet).toHaveCount(0);
  await expect(card).toHaveAttribute('data-exercise-id', pickedId!);
  await expect(card.getByTestId('exercise-name')).toHaveText(pickedName!);
  await expect(card.getByTestId('exercise-name')).not.toHaveText(BENCH_NAME);
  // Nothing was done yet, so the swap is in place: same card uid.
  await expect(card).toHaveAttribute('data-uid', uid!);

  const { draft } = await tytax.snapshot();
  expect(draft?.exercises.map((e) => e.exerciseId)).toEqual([pickedId]);
});
