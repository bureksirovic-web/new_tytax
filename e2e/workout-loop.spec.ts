import { test, expect } from './fixtures';
import type { TytaxFixture } from './fixtures';

// e2e/fixtures exports no Page/Locator types (request docs/v2/requests/G3-01.md); derive them from `test`.
type Fixtures = Parameters<Parameters<typeof test.beforeEach>[1]>[0];
type Page = Fixtures['page'];
type Locator = ReturnType<Page['locator']>;

/**
 * Active-workout loop details: duplicate exercises, reordering, deleting
 * sets, exercise video links, and a draft + running rest timer that survive
 * a reload.
 */

const BENCH_ID = 'tytax_smith-machine_smith-flat-bench-press';
const SQUAT_ID = 'tytax_smith-machine_smith-back-squat';
/** Catalog entry with exactly one video, on app.tytax.com. */
const LASER_ID = 'tytax_tytax_laser1';
/** Catalog entry with no videos. */
const FLOOR_PRESS_ID = 'tytax_smith-machine_smith-floor-press';

async function startQuick(page: Page, tytax: TytaxFixture) {
  await tytax.gotoApp('/workout');
  await tytax.reset();
  await tytax.gotoApp('/workout');
  await page.getByTestId('start-quick-workout').click();
  await expect(page).toHaveURL(/\/workout\/active$/);
}

async function addExercise(page: Page, query: string, id: string): Promise<void> {
  const cards = page.getByTestId('session-exercise');
  const before = await cards.count();
  await page.getByTestId('add-exercise-button').click();
  await page.getByTestId('exercise-search').fill(query);
  await page.locator(`[data-testid="exercise-option"][data-exercise-id="${id}"]`).click();
  await expect(cards).toHaveCount(before + 1);
}

async function logSet(row: Locator, kg: string, reps: string) {
  await row.getByTestId('set-kg').fill(kg);
  await row.getByTestId('set-reps').fill(reps);
  await row.getByTestId('set-done').click();
  await expect(row).toHaveAttribute('data-done', 'true');
}

test('the same exercise added twice logs independently', async ({ page, tytax }) => {
  await startQuick(page, tytax);
  await addExercise(page, 'Smith Flat Bench', BENCH_ID);
  await addExercise(page, 'Smith Flat Bench', BENCH_ID);

  const cards = page.locator(`[data-testid="session-exercise"][data-exercise-id="${BENCH_ID}"]`);
  await expect(cards).toHaveCount(2);
  const uids = await cards.evaluateAll((els) => els.map((el) => el.getAttribute('data-uid')));
  expect(new Set(uids).size).toBe(2);

  await logSet(cards.nth(0).getByTestId('set-row').first(), '60', '10');
  await logSet(cards.nth(1).getByTestId('set-row').first(), '70', '6');
  await expect(cards.nth(0).getByTestId('set-row').first().getByTestId('set-kg')).toHaveValue('60');
  await expect(cards.nth(1).getByTestId('set-row').first().getByTestId('set-kg')).toHaveValue('70');

  await page.getByTestId('finish-workout').click();
  await page.getByTestId('save-workout').click();
  await expect(page).toHaveURL(/\/history$/);

  const { activeProfileId } = await tytax.snapshot();
  const [log] = await tytax.listLogs(activeProfileId!);
  expect(log.exercises.map((e) => e.exerciseId)).toEqual([BENCH_ID, BENCH_ID]);
  expect(log.exercises.map((e) => e.sets.filter((s) => s.done).map((s) => [s.kg, s.reps]))).toEqual([
    [[60, 10]],
    [[70, 6]],
  ]);
});

test('reordering moves the card and survives a reload', async ({ page, tytax }) => {
  await startQuick(page, tytax);
  await addExercise(page, 'Smith Flat Bench', BENCH_ID);
  await addExercise(page, 'Smith Back Squat', SQUAT_ID);

  const cards = page.getByTestId('session-exercise');
  await expect(cards.first()).toHaveAttribute('data-exercise-id', BENCH_ID);
  await expect(cards.first().getByTestId('move-exercise-up')).toBeDisabled();
  await expect(cards.last().getByTestId('move-exercise-down')).toBeDisabled();

  await cards.first().getByTestId('move-exercise-down').click();
  await expect(cards.nth(0)).toHaveAttribute('data-exercise-id', SQUAT_ID);
  await expect(cards.nth(1)).toHaveAttribute('data-exercise-id', BENCH_ID);

  await page.reload();
  await expect(cards).toHaveCount(2);
  await expect(cards.nth(0)).toHaveAttribute('data-exercise-id', SQUAT_ID);

  await cards.nth(1).getByTestId('move-exercise-up').click();
  await expect(cards.nth(0)).toHaveAttribute('data-exercise-id', BENCH_ID);

  await cards.nth(1).getByTestId('remove-exercise').click();
  await expect(cards).toHaveCount(1);
  await expect(cards.first()).toHaveAttribute('data-exercise-id', BENCH_ID);
});

test('deleting sets: an empty set goes at once, a logged one asks first', async ({ page, tytax }) => {
  await startQuick(page, tytax);
  await addExercise(page, 'Smith Flat Bench', BENCH_ID);
  const rows = page.getByTestId('session-exercise').getByTestId('set-row');
  await expect(rows).toHaveCount(3);

  await rows.nth(2).getByTestId('remove-set').click();
  await expect(rows).toHaveCount(2);

  await rows.first().getByTestId('set-kg').fill('50');
  await rows.first().getByTestId('remove-set').click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: /^(Odustani|Cancel)$/ }).click();
  await expect(dialog).toHaveCount(0);
  await expect(rows).toHaveCount(2);

  await rows.first().getByTestId('remove-set').click();
  await page.getByRole('dialog').getByRole('button', { name: /^(Obriši|Delete)$/ }).click();
  await expect(rows).toHaveCount(1);
  await expect(rows.first().getByTestId('set-kg')).toHaveValue('');

  await page.getByTestId('add-set').click();
  await expect(rows).toHaveCount(2);
});

test('video button: app.tytax link, YouTube links in a menu, YouTube search fallback', async ({ page, tytax }) => {
  await startQuick(page, tytax);
  await addExercise(page, 'Laser1', LASER_ID);
  await addExercise(page, 'Smith Floor Press', FLOOR_PRESS_ID);
  await addExercise(page, 'Smith Flat Bench', BENCH_ID);
  const card = (id: string) => page.locator(`[data-testid="session-exercise"][data-exercise-id="${id}"]`);

  // One link → a direct <a> to app.tytax.com.
  const laser = card(LASER_ID).getByTestId('video-button');
  await expect(laser).toHaveAttribute('href', /^https:\/\/app\.tytax\.com\//);
  await expect(laser).toHaveAttribute('target', '_blank');

  // No links → YouTube search for the name.
  await expect(card(FLOOR_PRESS_ID).getByTestId('video-button')).toHaveAttribute(
    'href',
    'https://www.youtube.com/results?search_query=Smith%20Floor%20Press',
  );

  // Several links → a menu: app.tytax first, then the YouTube videos.
  const benchVideo = card(BENCH_ID).getByTestId('video-button');
  await expect(benchVideo).not.toHaveAttribute('href', /.*/);
  await benchVideo.click();
  const options = card(BENCH_ID).getByTestId('video-menu').getByTestId('video-option');
  await expect(options).toHaveCount(3);
  await expect(options.nth(0)).toHaveAttribute('href', /^https:\/\/app\.tytax\.com\//);
  await expect(options.nth(1)).toHaveAttribute('href', /^https:\/\/www\.youtube\.com\/watch\?v=/);
  await expect(options.nth(2)).toHaveAttribute('href', /^https:\/\/www\.youtube\.com\/watch\?v=/);
  await page.keyboard.press('Escape');
  await expect(card(BENCH_ID).getByTestId('video-menu')).toHaveCount(0);
});

test('a draft survives a reload with its rest timer still running', async ({ page, tytax }) => {
  await page.clock.install({ time: new Date('2026-09-20T10:00:00Z') });
  await startQuick(page, tytax);
  await addExercise(page, 'Smith Flat Bench', BENCH_ID);
  const row = page.getByTestId('set-row').first();
  // Freeze time so every displayed value is exact.
  await page.clock.pauseAt(new Date('2026-09-20T11:00:00Z'));
  await logSet(row, '60', '8');
  const remaining = page.getByTestId('rest-timer-remaining');
  await expect(remaining).toHaveText('1:30');
  await page.clock.runFor(10_000);
  await expect(remaining).toHaveText('1:20');

  await page.reload();
  await expect(page.getByTestId('active-workout')).toBeVisible();
  await expect(row).toHaveAttribute('data-done', 'true');
  await expect(row.getByTestId('set-kg')).toHaveValue('60');
  // Resumed, not restarted (1:30) and not frozen: it keeps counting from 1:20.
  await expect(remaining).toHaveText('1:20');
  await page.clock.runFor(5_000);
  await expect(remaining).toHaveText('1:15');

  const { draft } = await tytax.snapshot();
  expect(draft?.exercises).toHaveLength(1);
  expect(draft?.exercises[0].sets[0]).toMatchObject({ kg: 60, reps: 8, done: true });
});
