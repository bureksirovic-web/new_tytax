import { test, expect } from './fixtures';

// e2e/fixtures exports no Page type (request docs/v2/requests/G3-01.md); derive it from `test`.
type Fixtures = Parameters<Parameters<typeof test.beforeEach>[1]>[0];
type Page = Fixtures['page'];

/**
 * Wave 2 workout features (signals/WAVE2.md, G3 items 2–4, 7):
 * time-measured sets (typed duration + hold timer), order by station,
 * machine setup at workout time, and the 360 px set-row layout.
 *
 * "Repeat workout" (item 5, startFromLog) has no G3 UI entry: G4 owns the
 * History button, so it is covered by unit tests only
 * (src/stores/__tests__/workout-store-w2.test.ts, src/hooks/__tests__/use-workout-w2.test.ts).
 */

// Catalog `measure: 'time'` (G1 tag; defaultReps "20-40s").
const HOLD_ID = 'tytax_smith-machine_smith-bar-static-hold-double-overhand';
// station "Leg Curl" (rank 4 of the station order).
const LEG_CURL_ID = 'tytax_leg-curl_seated-leg-curl';
// station "Smith Machine" (rank 0).
const BENCH_ID = 'tytax_smith-machine_smith-flat-bench-press';
const SQUAT_ID = 'tytax_smith-machine_smith-back-squat';

async function startQuick(page: Page) {
  await page.getByTestId('start-quick-workout').click();
  await expect(page).toHaveURL(/\/workout\/active$/);
}

async function addExercise(page: Page, search: string, id: string) {
  await page.getByTestId('add-exercise-button').click();
  await page.getByTestId('exercise-search').fill(search);
  await page.locator(`[data-testid="exercise-option"][data-exercise-id="${id}"]`).click();
  await expect(page.getByTestId('exercise-picker')).toHaveCount(0);
}

function card(page: Page, id: string) {
  return page.locator(`[data-testid="session-exercise"][data-exercise-id="${id}"]`);
}

test('time set: typed 45 s and a 30 s hold are saved as durations with no kg volume', async ({ page, tytax }) => {
  await page.clock.install({ time: new Date('2026-09-27T10:00:00Z') });
  await tytax.gotoApp('/workout');
  await tytax.reset();
  await startQuick(page);
  await addExercise(page, 'smith bar static hold', HOLD_ID);

  const rows = card(page, HOLD_ID).getByTestId('set-row');
  // First-ever exercise: min(defaultSets 2, 3) = 2 working sets.
  await expect(rows).toHaveCount(2);
  const first = rows.nth(0);
  // A time row: duration + hold timer, no kg/reps.
  await expect(first.getByTestId('set-kg')).toHaveCount(0);
  await expect(first.getByTestId('set-reps')).toHaveCount(0);
  await expect(first.getByTestId('set-done')).toBeDisabled();

  await first.getByTestId('set-duration').fill('45');
  await first.getByTestId('set-duration').blur();
  await expect(first.getByTestId('set-duration')).toHaveValue('0:45');
  await first.getByTestId('set-done').click();
  await expect(first).toHaveAttribute('data-done', 'true');

  // Hold timer on the second set with a frozen clock: 30 s → "0:30".
  const second = rows.nth(1);
  await page.clock.pauseAt(new Date('2026-09-27T11:00:00Z'));
  const hold = second.getByTestId('set-hold-toggle');
  await hold.click();
  await expect(hold).toHaveAttribute('aria-pressed', 'true');
  await page.clock.runFor(30_000);
  await expect(second.getByTestId('set-hold-elapsed')).toHaveText('0:30');
  await hold.click();
  await expect(hold).toHaveAttribute('aria-pressed', 'false');
  await expect(second.getByTestId('set-hold-elapsed')).toHaveCount(0);
  await expect(second.getByTestId('set-duration')).toHaveValue('0:30');
  await second.getByTestId('set-done').click();
  await expect(second).toHaveAttribute('data-done', 'true');
  // Let time flow again: the debrief page loads through timers.
  await page.clock.resume();

  await page.getByTestId('finish-workout').click();
  await expect(page).toHaveURL(/\/workout\/debrief$/);
  await page.getByTestId('save-workout').click();
  await expect(page).toHaveURL(/\/history$/);

  const { activeProfileId } = await tytax.snapshot();
  expect(activeProfileId).toEqual(expect.any(String));
  const logs = await tytax.listLogs(activeProfileId!);
  expect(logs).toHaveLength(1);
  const [log] = logs;
  const done = log.exercises[0].sets.filter((s) => s.done);
  expect(done.map((s) => s.durationSeconds)).toEqual([45, 30]);
  // Time sets carry no kg: volume stays 0.
  expect(log.totalVolumeKg).toBe(0);
  expect(log.totalSets).toBe(2);
});

test('a finished 45 s hold comes back as the placeholder only: the next duration starts empty', async ({ page, tytax }) => {
  // Refuter-2 F1/F6: history is created through a real finished workout (the seed fixture has no
  // durationSeconds, docs/v2/requests/G3-W2-03.md), then the same exercise is started again.
  await tytax.gotoApp('/workout');
  await tytax.reset();
  await startQuick(page);
  await addExercise(page, 'smith bar static hold', HOLD_ID);
  const first = card(page, HOLD_ID).getByTestId('set-row').nth(0);
  await first.getByTestId('set-duration').fill('45');
  await first.getByTestId('set-duration').press('Enter');
  await expect(first).toHaveAttribute('data-done', 'true');
  await page.getByTestId('finish-workout').click();
  await expect(page).toHaveURL(/\/workout\/debrief$/);
  // Refuter-2 F3: the debrief shows the session's hold total.
  await expect(page.getByTestId('debrief-hold')).toHaveText(/0:45/);
  await page.getByTestId('save-workout').click();
  await expect(page).toHaveURL(/\/history$/);

  await tytax.gotoApp('/workout');
  await startQuick(page);
  await addExercise(page, 'smith bar static hold', HOLD_ID);
  const rows = card(page, HOLD_ID).getByTestId('set-row');
  await expect(rows).toHaveCount(2);
  const again = rows.nth(0);
  const duration = again.getByTestId('set-duration');
  await expect(duration).toHaveValue('');
  await expect(duration).toHaveAttribute('placeholder', '0:45');
  await expect(again).toHaveAttribute('data-done', 'false');
  // The second set was not done last time: no hint, and done stays disabled.
  await expect(rows.nth(1).getByTestId('set-duration')).toHaveValue('');
  await expect(rows.nth(1).getByTestId('set-done')).toBeDisabled();
  // Adopting the hint is an explicit action (Enter/done), the ghost-reps rule.
  await duration.press('Enter');
  await expect(again).toHaveAttribute('data-done', 'true');
  await expect(duration).toHaveValue('0:45');
});

test('order by station puts the Smith exercise before the leg curl and survives a reload', async ({ page, tytax }) => {
  await tytax.gotoApp('/workout');
  await tytax.reset();
  await startQuick(page);
  await addExercise(page, 'seated leg curl', LEG_CURL_ID);
  await addExercise(page, 'smith flat bench', BENCH_ID);

  const cards = page.getByTestId('session-exercise');
  await expect(cards).toHaveCount(2);
  await expect(cards.nth(0)).toHaveAttribute('data-exercise-id', LEG_CURL_ID);

  await page.getByTestId('order-by-station').click();
  await expect(page.getByTestId('order-by-station-status')).not.toBeEmpty();
  await expect(cards.nth(0)).toHaveAttribute('data-exercise-id', BENCH_ID);
  await expect(cards.nth(1)).toHaveAttribute('data-exercise-id', LEG_CURL_ID);

  await page.reload();
  await expect(page.getByTestId('active-workout')).toBeVisible();
  await expect(cards).toHaveCount(2);
  await expect(cards.nth(0)).toHaveAttribute('data-exercise-id', BENCH_ID);
  await expect(cards.nth(1)).toHaveAttribute('data-exercise-id', LEG_CURL_ID);
});

// Corrected at integration (G5, merge of v2-g3 after v2-g2): on v2-g3 alone the
// notes repo had no setup writer, so this test asserted the read-only sheet.
// With G2's `repo.notes.getSetup/setSetup` merged the sheet is writable, and
// docs/v2/requests/G3-W2-01.md asks for exactly this flip: edit -> save ->
// shown on the card -> survives a reload -> clearing removes it.
test('machine setup: saved from the sheet, shown on the card, survives a reload and clears', async ({ page, tytax }) => {
  await tytax.gotoApp('/workout');
  await tytax.reset();
  await startQuick(page);
  await addExercise(page, 'smith flat bench', BENCH_ID);

  // Nothing stored yet: no summary on the card.
  await expect(card(page, BENCH_ID).getByTestId('exercise-setup')).toHaveCount(0);

  const opener = card(page, BENCH_ID).getByTestId('edit-setup');
  await opener.click();
  const sheet = page.getByTestId('setup-sheet');
  await expect(sheet).toBeVisible();
  await expect(sheet.getByTestId('setup-readonly')).toHaveCount(0);
  await expect(sheet.getByTestId('setup-seat')).not.toHaveAttribute('readonly', '');
  await sheet.getByTestId('setup-seat').fill('  4  ');
  await sheet.getByTestId('setup-pin').fill('7');
  await sheet.getByTestId('setup-save').click();
  await expect(sheet).toHaveCount(0);

  const summary = card(page, BENCH_ID).getByTestId('exercise-setup');
  await expect(summary.getByTestId('exercise-setup-seat')).toContainText('4');
  await expect(summary.getByTestId('exercise-setup-pin')).toContainText('7');
  await expect(summary.getByTestId('exercise-setup-backrest')).toHaveCount(0);

  await page.reload();
  await expect(page.getByTestId('active-workout')).toBeVisible();
  await expect(summary.getByTestId('exercise-setup-seat')).toContainText('4');
  await expect(summary.getByTestId('exercise-setup-pin')).toContainText('7');

  // Reopening shows the stored (trimmed) values; emptying every field clears it.
  await card(page, BENCH_ID).getByTestId('edit-setup').click();
  await expect(sheet.getByTestId('setup-seat')).toHaveValue('4');
  await sheet.getByTestId('setup-seat').fill('');
  await sheet.getByTestId('setup-pin').fill('');
  await sheet.getByTestId('setup-save').click();
  await expect(sheet).toHaveCount(0);
  await expect(card(page, BENCH_ID).getByTestId('exercise-setup')).toHaveCount(0);

  // Escape still closes the sheet and returns focus to the opener.
  const reopener = card(page, BENCH_ID).getByTestId('edit-setup');
  await reopener.click();
  await expect(sheet).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(sheet).toHaveCount(0);
  await expect(reopener).toBeFocused();
});

test.describe('360 px phone', () => {
  test.use({ viewport: { width: 360, height: 740 } });

  test('set rows keep every input at least 44 px wide, unclipped, with no horizontal scroll', async ({ page, tytax }) => {
    await tytax.gotoApp('/workout');
    await tytax.reset();
    await startQuick(page);
    await addExercise(page, 'smith flat bench', BENCH_ID);
    await addExercise(page, 'smith back squat', SQUAT_ID);

    const rows = page.getByTestId('set-row');
    // 2 exercises × 3 first-ever working sets.
    const count = 6;
    await expect(rows).toHaveCount(count);
    for (let i = 0; i < count; i++) {
      const row = rows.nth(i);
      await row.getByTestId('set-kg').fill('102.5');
      await row.getByTestId('set-reps').fill('10');
      await row.getByTestId('set-rir').fill('2');
    }
    await rows.nth(count - 1).getByTestId('set-rir').blur();

    const inputs = page.locator('[data-testid="set-kg"], [data-testid="set-reps"], [data-testid="set-rir"]');
    await expect(inputs).toHaveCount(18);
    await expect(inputs.first()).toHaveValue('102.5');
    const measured = await inputs.evaluateAll((els) =>
      els.map((el) => {
        const input = el as HTMLInputElement;
        return {
          id: input.dataset.testid,
          width: input.getBoundingClientRect().width,
          scrollWidth: input.scrollWidth,
          clientWidth: input.clientWidth,
        };
      }),
    );
    console.log('360px set-row inputs', JSON.stringify(measured));
    for (const m of measured) {
      expect(m.width, `${m.id} width`).toBeGreaterThanOrEqual(44);
      expect(m.scrollWidth, `${m.id} clipped`).toBeLessThanOrEqual(m.clientWidth);
    }
    const pageWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    console.log('360px documentElement.scrollWidth', pageWidth);
    expect(pageWidth).toBeLessThanOrEqual(360);

    // Refuter-2 F10: touch targets — inputs and the done/remove buttons are >= 44 px tall,
    // the buttons >= 44 px wide, and every control ends inside the 360 px viewport.
    const targets = page.locator(
      '[data-testid="set-kg"], [data-testid="set-reps"], [data-testid="set-rir"], [data-testid="set-done"], [data-testid="remove-set"]',
    );
    await expect(targets).toHaveCount(30);
    const boxes = await targets.evaluateAll((els) =>
      els.map((el) => {
        const r = el.getBoundingClientRect();
        return { id: (el as HTMLElement).dataset.testid, width: r.width, height: r.height, right: r.right };
      }),
    );
    console.log('360px set-row touch targets', JSON.stringify(boxes));
    for (const b of boxes) {
      expect(b.height, `${b.id} height`).toBeGreaterThanOrEqual(44);
      expect(b.width, `${b.id} width`).toBeGreaterThanOrEqual(44);
      expect(b.right, `${b.id} inside the viewport`).toBeLessThanOrEqual(360);
    }
  });

  test('time rows keep duration, RIR and the running hold button unclipped, with no horizontal scroll', async ({ page, tytax }) => {
    await page.clock.install({ time: new Date('2026-09-27T10:00:00Z') });
    await tytax.gotoApp('/workout');
    await tytax.reset();
    await startQuick(page);
    await addExercise(page, 'smith bar static hold', HOLD_ID);

    const rows = card(page, HOLD_ID).getByTestId('set-row');
    await expect(rows).toHaveCount(2);
    // Widest realistic value: "10:45" (645 s), plus RIR.
    await rows.nth(0).getByTestId('set-duration').fill('645');
    await rows.nth(0).getByTestId('set-duration').blur();
    await expect(rows.nth(0).getByTestId('set-duration')).toHaveValue('10:45');
    await rows.nth(0).getByTestId('set-rir').fill('2');
    // Second row: hold running at 0:30, the widest state of the hold button.
    await page.clock.pauseAt(new Date('2026-09-27T11:00:00Z'));
    await rows.nth(1).getByTestId('set-duration').fill('45');
    await rows.nth(1).getByTestId('set-hold-toggle').click();
    await page.clock.runFor(30_000);
    await expect(rows.nth(1).getByTestId('set-hold-elapsed')).toHaveText('0:30');

    const controls = card(page, HOLD_ID).locator(
      '[data-testid="set-duration"], [data-testid="set-rir"], [data-testid="set-hold-toggle"], [data-testid="set-done"]',
    );
    await expect(controls).toHaveCount(8);
    const measured = await controls.evaluateAll((els) =>
      els.map((el) => {
        const r = el.getBoundingClientRect();
        return { id: (el as HTMLElement).dataset.testid, width: r.width, height: r.height, right: r.right, scrollWidth: el.scrollWidth, clientWidth: el.clientWidth };
      }),
    );
    console.log('360px time-row controls', JSON.stringify(measured));
    for (const m of measured) {
      expect(m.width, `${m.id} width`).toBeGreaterThanOrEqual(44);
      expect(m.height, `${m.id} height`).toBeGreaterThanOrEqual(44);
      expect(m.scrollWidth, `${m.id} clipped`).toBeLessThanOrEqual(m.clientWidth);
      expect(m.right, `${m.id} inside the viewport`).toBeLessThanOrEqual(360);
    }
    const pageWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(pageWidth).toBeLessThanOrEqual(360);
  });
});
