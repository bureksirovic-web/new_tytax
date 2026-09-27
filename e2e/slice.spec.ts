import { test, expect } from './fixtures';

/**
 * Wave 0 vertical slice (PLAN §10.1 W0.4): quick workout → exercise → sets →
 * reload → finish → debrief → history, all through the real repository.
 */

const BENCH_ID = 'tytax_smith-machine_smith-flat-bench-press';
const BENCH_NAME = 'Smith Flat Bench Press';
const SQUAT_ID = 'tytax_smith-machine_smith-back-squat';
const SQUAT_NAME = 'Smith Back Squat';

const ENTERED_SETS = [
  { kg: '60', reps: '8', rir: '2' },
  { kg: '62.5', reps: '8', rir: '2' },
  { kg: '65', reps: '6', rir: '1' },
] as const;

test('quick workout survives a reload and lands in history', async ({ page, tytax }) => {
  await tytax.gotoApp('/workout');
  await tytax.reset();

  await page.getByTestId('start-quick-workout').click();
  await expect(page).toHaveURL(/\/workout\/active/);

  await page.getByTestId('add-exercise-button').click();
  await page.getByTestId('exercise-search').fill('Smith Flat Bench');
  await page.locator(`[data-testid="exercise-option"][data-exercise-id="${BENCH_ID}"]`).click();

  const card = page.getByTestId('session-exercise');
  await expect(card).toHaveCount(1);
  const rows = card.getByTestId('set-row');
  // 3: addExercise creates min(defaultSets, 3) sets and this exercise has defaultSets 3, so no add-set click is needed.
  await expect(rows).toHaveCount(3);

  for (const [i, entry] of ENTERED_SETS.entries()) {
    const row = rows.nth(i);
    await row.getByTestId('set-kg').fill(entry.kg);
    await row.getByTestId('set-reps').fill(entry.reps);
    await row.getByTestId('set-rir').fill(entry.rir);
    await row.getByTestId('set-done').click();
    await expect(row.getByTestId('set-done')).toHaveAttribute('aria-pressed', 'true');
  }

  await page.reload();
  // 3: the three sets entered above, restored from the persisted draft.
  await expect(rows).toHaveCount(3);
  for (const [i, entry] of ENTERED_SETS.entries()) {
    const row = rows.nth(i);
    await expect(row.getByTestId('set-kg')).toHaveValue(entry.kg);
    await expect(row.getByTestId('set-done')).toHaveAttribute('aria-pressed', 'true');
  }

  await page.getByTestId('finish-workout').click();
  await expect(page).toHaveURL(/\/workout\/debrief/);
  await page.getByTestId('debrief-rpe').fill('8');
  await page.getByTestId('save-workout').click();
  await expect(page).toHaveURL(/\/history/);

  const items = page.getByTestId('history-item');
  // 1: one finished workout on a freshly reset profile.
  await expect(items).toHaveCount(1);
  await expect(items).toContainText(BENCH_NAME);
  // '3': three done working sets.
  await expect(items.getByTestId('history-item-sets')).toHaveText('3');

  const { activeProfileId } = await tytax.snapshot();
  expect(activeProfileId).toEqual(expect.any(String));
  const logs = await tytax.listLogs(activeProfileId!);
  // 1: the one workout saved above.
  expect(logs).toHaveLength(1);
  const [log] = logs;
  // 3: three done working sets.
  expect(log.totalSets).toBe(3);
  // 8: the RPE entered on the debrief screen.
  expect(log.rpe).toBe(8);
  // 60×8 + 62.5×8 + 65×6 = 480 + 500 + 390 = 1370 kg.
  expect(log.totalVolumeKg).toBe(1370);
  expect(log.exercises.map((e) => e.exerciseId)).toEqual([BENCH_ID]);
  // 3: one entry per set row.
  expect(log.exercises[0].sets).toHaveLength(3);
  expect(log.exercises[0].sets.map((s) => [s.kg, s.reps, s.rir, s.done])).toEqual([
    [60, 8, 2, true],
    [62.5, 8, 2, true],
    [65, 6, 1, true],
  ]);
});

test('a seeded history shows in the history list', async ({ page, tytax }) => {
  await tytax.gotoApp('/history');
  await tytax.reset();
  const { activeProfileId } = await tytax.snapshot();
  expect(activeProfileId).toEqual(expect.any(String));

  const seeded = await tytax.seedHistory(activeProfileId!, [
    {
      daysAgo: 1,
      sessionName: 'Seeded Upper',
      exercises: [
        {
          exerciseId: BENCH_ID,
          exerciseName: BENCH_NAME,
          sets: [
            { kg: 50, reps: 10, rir: 2 },
            { kg: 55, reps: 8, rir: 1 },
          ],
        },
      ],
    },
    {
      daysAgo: 3,
      sessionName: 'Seeded Deleted',
      deleted: true,
      exercises: [{ exerciseId: SQUAT_ID, exerciseName: SQUAT_NAME, sets: [{ kg: 80, reps: 5 }] }],
    },
  ]);
  // 2: both seeded logs were written, the soft-deleted one included.
  expect(seeded).toHaveLength(2);
  // 1: the repository hides the soft-deleted log.
  expect(await tytax.listLogs(activeProfileId!)).toHaveLength(1);

  await tytax.gotoApp('/history');
  const items = page.getByTestId('history-item');
  // 1: only the log that is not soft-deleted is listed.
  await expect(items).toHaveCount(1);
  await expect(items).toContainText(BENCH_NAME);
  await expect(items).not.toContainText(SQUAT_NAME);
  // '2': two done working sets in the visible log.
  await expect(items.getByTestId('history-item-sets')).toHaveText('2');
});
