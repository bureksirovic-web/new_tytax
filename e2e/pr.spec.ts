import { test, expect } from './fixtures';

// e2e/fixtures exports no Page/Locator types (request docs/v2/requests/G3-01.md); derive them from `test`.
type Fixtures = Parameters<Parameters<typeof test.beforeEach>[1]>[0];
type Page = Fixtures['page'];
type Locator = ReturnType<Page['locator']>;

/**
 * AC6: PR celebration after save.
 *
 * PRs compare against stored PR records (repo.finishWorkout). `seedHistory`
 * writes logs only, no PR records, so the "previous best" is established by
 * a real finished workout through the UI (its records are baselines).
 */

const BENCH_ID = 'tytax_smith-machine_smith-flat-bench-press';
const BENCH_NAME = 'Smith Flat Bench Press';

const working = '[data-testid="set-row"][data-set-type="working"]';
const warmup = '[data-testid="set-row"][data-set-type="warmup"]';

async function startWithBench(page: Page): Promise<Locator> {
  await page.getByTestId('start-quick-workout').click();
  await expect(page).toHaveURL(/\/workout\/active$/);
  await page.getByTestId('add-exercise-button').click();
  await page.getByTestId('exercise-search').fill('Smith Flat Bench');
  await page.locator(`[data-testid="exercise-option"][data-exercise-id="${BENCH_ID}"]`).click();
  const card = page.locator(`[data-testid="session-exercise"][data-exercise-id="${BENCH_ID}"]`);
  await expect(card).toHaveCount(1);
  return card;
}

async function logSet(row: Locator, kg: string, reps: string, done = true) {
  await row.getByTestId('set-kg').fill(kg);
  await row.getByTestId('set-reps').fill(reps);
  if (done) {
    await row.getByTestId('set-done').click();
    await expect(row).toHaveAttribute('data-done', 'true');
  }
}

async function finishAndSave(page: Page) {
  await page.getByTestId('finish-workout').click();
  await expect(page).toHaveURL(/\/workout\/debrief$/);
  await page.getByTestId('save-workout').click();
}

/** Workout 1: bench 100 × 5 done, one working set. Saves as baselines, no celebration. */
async function baselineWorkout(page: Page) {
  const card = await startWithBench(page);
  const rows = card.locator(working);
  await expect(rows).toHaveCount(3);
  await rows.nth(2).getByTestId('remove-set').click();
  await rows.nth(1).getByTestId('remove-set').click();
  await expect(rows).toHaveCount(1);
  await logSet(rows.first(), '100', '5');
  await finishAndSave(page);
  await expect(page).toHaveURL(/\/history$/);
  await expect(page.getByTestId('pr-celebration')).toHaveCount(0);
}

test('beating the stored best e1RM celebrates the PR and persists it', async ({ page, tytax }) => {
  await tytax.gotoApp('/workout');
  await tytax.reset();
  await baselineWorkout(page);

  await tytax.gotoApp('/workout');
  const card = await startWithBench(page);
  // Prefill from workout 1: one working set at 100 kg (no RIR recorded → hold).
  const rows = card.locator(working);
  await expect(rows).toHaveCount(1);
  await logSet(rows.first(), '105', '5');
  await finishAndSave(page);

  const dialog = page.getByTestId('pr-celebration');
  await expect(dialog).toBeVisible();
  const items = dialog.getByTestId('pr-celebration-item');
  // e1RM (105×36/32 = 118.13 > 112.5) and weight (105 > 100).
  await expect(items).toHaveCount(2);
  await expect(items.first()).toHaveAttribute('data-exercise-id', BENCH_ID);
  await expect(items.first()).toHaveAttribute('data-pr-type', 'e1rm');
  await expect(items.first()).toContainText(BENCH_NAME);
  await expect(items.nth(1)).toHaveAttribute('data-pr-type', 'weight');
  await expect(items.nth(1).getByTestId('pr-celebration-value')).toContainText('105');
  await expect(items.nth(1).getByTestId('pr-celebration-previous')).toContainText('100');
  await expect(page).toHaveURL(/\/workout\/debrief$/);

  await dialog.getByTestId('pr-celebration-continue').click();
  await expect(page).toHaveURL(/\/history$/);
  await expect(page.getByTestId('history-item')).toHaveCount(2);

  const { activeProfileId, draft } = await tytax.snapshot();
  expect(draft).toBeNull();
  const logs = await tytax.listLogs(activeProfileId!);
  expect(logs).toHaveLength(2);
  const newest = logs.find((l) => l.exercises[0].sets.some((s) => s.kg === 105));
  expect(newest?.prCount).toBe(2);
  expect(newest?.exercises[0].sets.filter((s) => s.isPR).map((s) => s.kg)).toEqual([105]);
});

test('a heavier warm-up or undone set is not a PR: straight to history', async ({ page, tytax }) => {
  await tytax.gotoApp('/workout');
  await tytax.reset();
  await baselineWorkout(page);

  await tytax.gotoApp('/workout');
  const card = await startWithBench(page);
  // With history, warm-ups are generated (standard ladder on 100 kg: 50, 75).
  const warm = card.locator(warmup);
  await expect(warm).toHaveCount(2);
  await logSet(warm.first(), '150', '5');
  await logSet(card.locator(working).first(), '90', '5');
  await card.getByTestId('add-set').click();
  const rows = card.locator(working);
  await expect(rows).toHaveCount(2);
  await logSet(rows.nth(1), '200', '5', false);
  await expect(rows.nth(1)).toHaveAttribute('data-done', 'false');

  await finishAndSave(page);
  await expect(page).toHaveURL(/\/history$/);
  await expect(page.getByTestId('pr-celebration')).toHaveCount(0);

  const { activeProfileId } = await tytax.snapshot();
  const logs = await tytax.listLogs(activeProfileId!);
  expect(logs).toHaveLength(2);
  const second = logs.find((l) => l.exercises[0].sets.some((s) => s.kg === 150));
  expect(second?.prCount).toBe(0);
  // Only the done 90 kg working set counts.
  expect(second?.totalSets).toBe(1);
});

test('a first-ever exercise is a baseline: no celebration', async ({ page, tytax }) => {
  await tytax.gotoApp('/workout');
  await tytax.reset();
  const card = await startWithBench(page);
  const rows = card.locator(working);
  await logSet(rows.first(), '140', '3');
  await finishAndSave(page);

  await expect(page).toHaveURL(/\/history$/);
  await expect(page.getByTestId('pr-celebration')).toHaveCount(0);
  const { activeProfileId } = await tytax.snapshot();
  const logs = await tytax.listLogs(activeProfileId!);
  expect(logs).toHaveLength(1);
  expect(logs[0].prCount).toBe(0);
  expect(logs[0].exercises[0].sets.some((s) => s.isPR === true)).toBe(false);
});
