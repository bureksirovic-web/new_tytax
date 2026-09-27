import { test, expect } from './fixtures';

/**
 * AC7 (family-profiles plan, piece 4; critic round 1): a youth profile that
 * did 2 qualifying Negative Dip sessions finishes a 3rd through the UI. The
 * debrief shows the progression card (with the adult-confirmation gate), and
 * accepting swaps Negative Dip for Parallel Bar Dip in the program session the
 * workout came from (session B, index 1), leaving session A untouched.
 * Named `progression-step`: `e2e/progression.spec.ts` covers weight prefill.
 */

const PARENT_ID = 'bw_dip_negative-dip';
const PARENT_NAME = 'Negative Dip';
const CHILD_ID = 'bw_dip_parallel-bar-dip';
const CHILD_NAME = 'Parallel Bar Dip';
const OTHER_ID = 'bw_squat_air-squat';
const OTHER_NAME = 'Air Squat';

test('youth: negative dip -> parallel bar dip is offered after 2 qualifying sessions and swapped in the originating session', async ({ page, tytax }) => {
  await tytax.gotoApp('/workout');
  await tytax.reset();
  const profile = await tytax.seedProfile({ name: 'Kid', birthYear: new Date().getFullYear() - 11 });

  // 2 qualifying past sessions: both prescribed working sets done at the top of "5-8".
  const qualifying = { exerciseId: PARENT_ID, exerciseName: PARENT_NAME, modality: 'bodyweight' as const, sets: [{ kg: 0, reps: 8 }, { kg: 0, reps: 8 }] };
  await tytax.seedHistory(profile.id, [
    { daysAgo: 5, sessionName: 'B', exercises: [qualifying] },
    { daysAgo: 3, sessionName: 'B', exercises: [qualifying] },
  ]);

  const program = await tytax.seedProgram(profile.id, {
    template: {
      name: 'Dip Start',
      splitType: 'custom',
      frequency: 2,
      periodizationType: 'none',
      sessionOrder: ['A', 'B'],
      sessions: [
        { id: 's-a', programId: '', name: 'A', dayIndex: 0, exercises: [{ exerciseId: OTHER_ID, exerciseName: OTHER_NAME, modality: 'bodyweight', sets: 2, reps: '12-15' }] },
        { id: 's-b', programId: '', name: 'B', dayIndex: 1, exercises: [{ exerciseId: PARENT_ID, exerciseName: PARENT_NAME, modality: 'bodyweight', sets: 2, reps: '5-8' }] },
      ],
      modalitiesUsed: ['bodyweight'],
      isPreset: false,
      currentSessionIndex: 1,
    },
  });

  // The 3rd, live qualifying workout: session B, started from the dashboard.
  await tytax.gotoApp('/dashboard');
  await expect(page.getByTestId('dash-session-name')).toContainText('B');
  await page.getByTestId('dash-start-session').click();
  await expect(page).toHaveURL(/\/workout\/active$/);

  const card = page.locator(`[data-testid="session-exercise"][data-exercise-id="${PARENT_ID}"]`);
  await expect(card).toHaveCount(1);
  const sets = card.locator('[data-testid="set-row"][data-set-type="working"]');
  await expect(sets).toHaveCount(2);
  for (const i of [0, 1]) {
    await sets.nth(i).getByTestId('set-reps').fill('8');
    await sets.nth(i).getByTestId('set-done').click();
    await expect(sets.nth(i)).toHaveAttribute('data-done', 'true');
  }

  await page.getByTestId('finish-workout').click();
  await expect(page).toHaveURL(/\/workout\/debrief$/);
  await page.getByTestId('save-workout').click();

  const progressionCard = page.getByTestId('progression-card');
  await expect(progressionCard).toBeVisible();
  await expect(progressionCard).toHaveAttribute('data-exercise-id', PARENT_ID);
  await expect(progressionCard).toHaveAttribute('data-next-exercise-id', CHILD_ID);

  // Youth: the accept button waits for the adult confirmation.
  const accept = page.getByTestId('progression-accept');
  await expect(accept).toBeDisabled();
  await page.getByTestId('progression-youth-confirm').check();
  await expect(accept).toBeEnabled();
  await accept.click();
  await expect(page).toHaveURL(/\/history$/);

  // Session B (the originating programSessionId) now has the next step; session A is untouched.
  await tytax.gotoApp(`/programs/${program.id}`);
  const sessions = page.getByTestId('session-card');
  await expect(sessions).toHaveCount(2);
  await expect(sessions.nth(1)).toContainText(CHILD_NAME);
  await expect(sessions.nth(1)).not.toContainText(PARENT_NAME);
  await expect(sessions.nth(0)).toContainText(OTHER_NAME);
  await expect(sessions.nth(0)).not.toContainText(CHILD_NAME);
});
