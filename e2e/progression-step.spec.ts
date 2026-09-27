import { test, expect } from './fixtures';

/**
 * AC7 (family-profiles plan, piece 4): progression-prompt card on the
 * debrief screen, and accepting it swaps the exercise in the program session
 * the workout came from. Named `progression-step` (not `progression`) since
 * an existing `e2e/progression.spec.ts` already covers weights progression
 * (prefill/warm-ups).
 *
 * `bw_push_incline-push-up` (reps, defaultReps "12-15") is used rather than a
 * dip-bar exercise: it exists in the catalog today and needs no youth preset
 * or new catalog entry from a parallel piece of this plan to land first.
 * Its progression child is `bw_push_knee-push-up` ("Knee Push-Up").
 */

const PARENT_ID = 'bw_push_incline-push-up';
const PARENT_NAME = 'Incline Push-Up';
const CHILD_ID = 'bw_push_knee-push-up';
const CHILD_NAME = 'Knee Push-Up';

test('a qualifying workout shows the progression card, and accepting it swaps the program session exercise', async ({ page, tytax }) => {
  await tytax.gotoApp('/workout');
  await tytax.reset();
  const profile = await tytax.seedProfile({ name: 'Progression Step' });

  // 2 qualifying past sessions: the single prescribed working set done at the top of the "12-15" range.
  await tytax.seedHistory(profile.id, [
    {
      daysAgo: 4,
      sessionName: 'Seeded A',
      exercises: [{ exerciseId: PARENT_ID, exerciseName: PARENT_NAME, modality: 'bodyweight', sets: [{ kg: 0, reps: 15 }] }],
    },
    {
      daysAgo: 2,
      sessionName: 'Seeded B',
      exercises: [{ exerciseId: PARENT_ID, exerciseName: PARENT_NAME, modality: 'bodyweight', sets: [{ kg: 0, reps: 15 }] }],
    },
  ]);

  const program = await tytax.seedProgram(profile.id, {
    template: {
      name: 'Push Starter',
      splitType: 'custom',
      frequency: 1,
      periodizationType: 'none',
      sessionOrder: ['A'],
      sessions: [
        {
          id: 's-a',
          programId: '',
          name: 'A',
          dayIndex: 0,
          exercises: [{ exerciseId: PARENT_ID, exerciseName: PARENT_NAME, modality: 'bodyweight', sets: 1, reps: '12-15' }],
        },
      ],
      modalitiesUsed: ['bodyweight'],
      isPreset: false,
      currentSessionIndex: 0,
    },
  });

  // Run the 3rd (live) qualifying workout through the UI, starting from the program.
  await tytax.gotoApp('/dashboard');
  await expect(page.getByTestId('dash-session-name')).toContainText('A');
  await page.getByTestId('dash-start-session').click();
  await expect(page).toHaveURL(/\/workout\/active$/);

  const card = page.locator(`[data-testid="session-exercise"][data-exercise-id="${PARENT_ID}"]`);
  await expect(card).toHaveCount(1);
  const workingSet = card.locator('[data-testid="set-row"][data-set-type="working"]').first();
  await workingSet.getByTestId('set-reps').fill('15');
  await workingSet.getByTestId('set-done').click();
  await expect(workingSet).toHaveAttribute('data-done', 'true');

  await page.getByTestId('finish-workout').click();
  await expect(page).toHaveURL(/\/workout\/debrief$/);
  await page.getByTestId('save-workout').click();

  // The progression card shows on the post-save screen (no PR to celebrate first, bodyweight sets carry no e1RM/weight PR).
  const progressionCard = page.getByTestId('progression-card');
  await expect(progressionCard).toBeVisible();
  await expect(progressionCard).toHaveAttribute('data-exercise-id', PARENT_ID);
  await expect(progressionCard).toHaveAttribute('data-next-exercise-id', CHILD_ID);
  await expect(page.getByTestId('progression-youth-confirm')).toHaveCount(0); // not a youth profile

  await page.getByTestId('progression-accept').click();
  await expect(page).toHaveURL(/\/history$/);

  // The active program's session now lists the next exercise instead of the parent.
  await tytax.gotoApp(`/programs/${program.id}`);
  const sessionCard = page.getByTestId('session-card').first();
  await expect(sessionCard).toContainText(CHILD_NAME);
  await expect(sessionCard).not.toContainText(PARENT_NAME);
});
