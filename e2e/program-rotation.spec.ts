import { DEFAULT_TYTAX_PRESET_ID, getPresetById } from '../src/lib/programs/presets';
import { test, expect } from './fixtures';

/**
 * AC4: an installed active program names its next session on /workout;
 * finishing that session advances the rotation and the log records which
 * program session it was.
 *
 * The dashboard (G4) exposes no testid for the predicted session in this
 * worktree, so the prediction is asserted on /workout only.
 */

test('finishing the first program session advances /workout to the second', async ({ page, tytax }) => {
  await tytax.gotoApp('/workout');
  await tytax.reset();
  const { activeProfileId } = await tytax.snapshot();
  expect(activeProfileId).toEqual(expect.any(String));
  const program = await tytax.seedProgram(activeProfileId!, { presetId: DEFAULT_TYTAX_PRESET_ID });
  const [first, second] = program.sessions;
  expect(program.currentSessionIndex).toBe(0);
  expect(first.isRest).not.toBe(true);
  expect(second.isRest).not.toBe(true);

  await tytax.gotoApp('/workout');
  await expect(page.getByTestId('active-program-card')).toContainText(program.name);
  await expect(page.getByTestId('next-session-name')).toHaveText(first.name);
  await expect(page.getByTestId('next-session-rest')).toHaveCount(0);

  await page.getByTestId('start-program-workout').click();
  await expect(page).toHaveURL(/\/workout\/active$/);
  const cards = page.getByTestId('session-exercise');
  // One card per slot of the first session, in program order.
  await expect(cards).toHaveCount(first.exercises.length);
  await expect(cards.first()).toHaveAttribute('data-exercise-id', first.exercises[0].exerciseId);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(first.name);

  // Log one working set of the first exercise.
  const row = cards.first().locator('[data-testid="set-row"][data-set-type="working"]').first();
  await row.getByTestId('set-kg').fill('60');
  await row.getByTestId('set-reps').fill('10');
  await row.getByTestId('set-done').click();
  await expect(row).toHaveAttribute('data-done', 'true');

  await page.getByTestId('finish-workout').click();
  await expect(page).toHaveURL(/\/workout\/debrief$/);
  await page.getByTestId('save-workout').click();
  await expect(page).toHaveURL(/\/history$/);

  await tytax.gotoApp('/workout');
  await expect(page.getByTestId('next-session-name')).toHaveText(second.name);
  await expect(page.getByTestId('current-draft')).toHaveCount(0);

  const logs = await tytax.listLogs(activeProfileId!);
  expect(logs).toHaveLength(1);
  expect(logs[0].programId).toBe(program.id);
  expect(logs[0].programSessionId).toBe(first.id);
  expect(logs[0].sessionName).toBe(first.name);
  expect(logs[0].totalSets).toBe(1);
});

test('a rest session is completed from /workout and the rotation wraps to the first session', async ({ page, tytax }) => {
  const preset = getPresetById(DEFAULT_TYTAX_PRESET_ID);
  expect(preset).toBeDefined();
  const restIndex = preset!.sessions.findIndex((s) => s.isRest === true);
  // The TYTAX preset ends with its rest day, so completing it wraps to session 0.
  expect(restIndex).toBe(preset!.sessions.length - 1);

  await tytax.gotoApp('/workout');
  await tytax.reset();
  const { activeProfileId } = await tytax.snapshot();
  expect(activeProfileId).toEqual(expect.any(String));
  const program = await tytax.seedProgram(activeProfileId!, { template: { ...preset!, currentSessionIndex: restIndex } });
  expect(program.currentSessionIndex).toBe(restIndex);

  await tytax.gotoApp('/workout');
  await expect(page.getByTestId('next-session-name')).toHaveText(program.sessions[restIndex].name);
  await expect(page.getByTestId('next-session-rest')).toBeVisible();
  await expect(page.getByTestId('start-program-workout')).toHaveCount(0);

  await page.getByTestId('complete-rest-day').click();
  await expect(page.getByTestId('next-session-name')).toHaveText(program.sessions[0].name);
  await expect(page.getByTestId('next-session-rest')).toHaveCount(0);
  await expect(page.getByTestId('start-program-workout')).toBeEnabled();

  // Persisted: a reload shows the first session again, and no log was written for the rest day.
  await tytax.gotoApp('/workout');
  await expect(page.getByTestId('next-session-name')).toHaveText(program.sessions[0].name);
  expect(await tytax.listLogs(activeProfileId!)).toHaveLength(0);
});
