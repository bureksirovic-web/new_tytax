import { test, expect, type Page } from './fixtures';
import type { SeedProfileInput, TytaxFixture } from './fixtures';


/**
 * AC5: progression prefill, ghost reps and generated warm-ups.
 *
 * Prefill (src/lib/training/prefill.ts): last session's lowest RIR ≥3 → +2.5 kg,
 * exactly 2 → +1.25 kg. Warm-ups (src/lib/training/warmups.ts) come from the
 * first prefilled working kg, rounded to 2.5 kg, never below the 20 kg bar.
 */

const BENCH_ID = 'tytax_smith-machine_smith-flat-bench-press';
const BENCH_NAME = 'Smith Flat Bench Press';
const SQUAT_ID = 'tytax_smith-machine_smith-back-squat';
const SQUAT_NAME = 'Smith Back Squat';

async function setupProfile(page: Page, tytax: TytaxFixture, settings: SeedProfileInput['settings']) {
  await tytax.gotoApp('/workout');
  await tytax.reset();
  const profile = await tytax.seedProfile({ name: 'Progression', settings });
  await tytax.seedHistory(profile.id, [
    {
      daysAgo: 2,
      sessionName: 'Seeded Upper',
      exercises: [
        { exerciseId: BENCH_ID, exerciseName: BENCH_NAME, sets: [{ kg: 100, reps: 8, rir: 3 }] },
        { exerciseId: SQUAT_ID, exerciseName: SQUAT_NAME, sets: [{ kg: 80, reps: 6, rir: 2 }] },
      ],
    },
  ]);
  await tytax.gotoApp('/workout');
  await page.getByTestId('start-quick-workout').click();
  await expect(page).toHaveURL(/\/workout\/active$/);
  return profile;
}

async function addExercise(page: Page, query: string, id: string) {
  await page.getByTestId('add-exercise-button').click();
  await page.getByTestId('exercise-search').fill(query);
  await page.locator(`[data-testid="exercise-option"][data-exercise-id="${id}"]`).click();
  const card = page.locator(`[data-testid="session-exercise"][data-exercise-id="${id}"]`);
  await expect(card).toHaveCount(1);
  return card;
}

const working = '[data-testid="set-row"][data-set-type="working"]';
const warmup = '[data-testid="set-row"][data-set-type="warmup"]';

test('RIR 3 adds 2.5 kg, RIR 2 adds 1.25 kg, and ghost reps mark a beaten set', async ({ page, tytax }) => {
  await setupProfile(page, tytax, { warmupStrategy: 'standard' });

  const bench = await addExercise(page, 'Smith Flat Bench', BENCH_ID);
  const benchSet = bench.locator(working);
  // 1: last session had one done working set.
  await expect(benchSet).toHaveCount(1);
  // 100 + 2.5 (RIR 3).
  await expect(benchSet.getByTestId('set-kg')).toHaveValue('102.5');
  // Ghosts from last time: 100 kg × 8.
  await expect(benchSet.getByTestId('set-kg')).toHaveAttribute('placeholder', '100');
  const reps = benchSet.getByTestId('set-reps');
  await expect(reps).toHaveAttribute('placeholder', '8');
  await expect(reps).toHaveValue('');
  await expect(reps).toHaveAttribute('data-beat', 'false');
  await reps.fill('8');
  await expect(reps).toHaveAttribute('data-beat', 'false');
  await reps.fill('9');
  await expect(reps).toHaveAttribute('data-beat', 'true');

  const squat = await addExercise(page, 'Smith Back Squat', SQUAT_ID);
  const squatSet = squat.locator(working);
  await expect(squatSet).toHaveCount(1);
  // 80 + 1.25 (RIR 2).
  await expect(squatSet.getByTestId('set-kg')).toHaveValue('81.25');
  await expect(squatSet.getByTestId('set-reps')).toHaveAttribute('placeholder', '6');
  // Standard ladder on 81.25: 50% → 40, 75% → 60.
  const squatWarm = squat.locator(warmup);
  await expect(squatWarm).toHaveCount(2);
  await expect(squatWarm.nth(0).getByTestId('set-kg')).toHaveValue('40');
  await expect(squatWarm.nth(1).getByTestId('set-kg')).toHaveValue('60');
});

const LADDERS = [
  // Working kg 102.5 (100 + 2.5). Standard 50/75 % → 52.5, 77.5.
  { strategy: 'standard', kg: ['52.5', '77.5'], reps: ['10', '5'] },
  // Heavy 50/75/85/95 % → 52.5, 77.5, 87.5, 97.5.
  { strategy: 'heavy', kg: ['52.5', '77.5', '87.5', '97.5'], reps: ['10', '5', '3', '1'] },
  // Pyramid 40/60/80 % → 40, 62.5, 82.5.
  { strategy: 'pyramid', kg: ['40', '62.5', '82.5'], reps: ['12', '8', '4'] },
] as const;

for (const ladder of LADDERS) {
  test(`${ladder.strategy} warm-up strategy generates ${ladder.kg.length} warm-up sets`, async ({ page, tytax }) => {
    await setupProfile(page, tytax, { warmupStrategy: ladder.strategy });
    const bench = await addExercise(page, 'Smith Flat Bench', BENCH_ID);

    const warm = bench.locator(warmup);
    await expect(warm).toHaveCount(ladder.kg.length);
    for (const [i, kg] of ladder.kg.entries()) {
      await expect(warm.nth(i).getByTestId('set-kg')).toHaveValue(kg);
      await expect(warm.nth(i).getByTestId('set-reps')).toHaveValue(ladder.reps[i]);
      await expect(warm.nth(i)).toHaveAttribute('data-done', 'false');
    }
    // Warm-ups come first, then the one prefilled working set.
    await expect(bench.getByTestId('set-row').last()).toHaveAttribute('data-set-type', 'working');
    await expect(bench.locator(working).getByTestId('set-kg')).toHaveValue('102.5');
    // Warm-ups exist already, so the manual "add warm-up" is off.
    await expect(bench.getByTestId('add-warmup')).toBeDisabled();
  });
}

test("'none' warm-up strategy adds no warm-ups; the manual button adds one 50% set", async ({ page, tytax }) => {
  await setupProfile(page, tytax, { warmupStrategy: 'none' });
  const bench = await addExercise(page, 'Smith Flat Bench', BENCH_ID);

  await expect(bench.locator(warmup)).toHaveCount(0);
  await expect(bench.locator(working).getByTestId('set-kg')).toHaveValue('102.5');
  const addWarmup = bench.getByTestId('add-warmup');
  await expect(addWarmup).toBeEnabled();
  await addWarmup.click();
  // Fallback: 102.5 × 0.5 = 51.25 → 52.5 (2.5 steps) × 10.
  await expect(bench.locator(warmup)).toHaveCount(1);
  await expect(bench.locator(warmup).getByTestId('set-kg')).toHaveValue('52.5');
  await expect(bench.locator(warmup).getByTestId('set-reps')).toHaveValue('10');
  await expect(addWarmup).toBeDisabled();
});

// Refuter R2 (2026-09-27): "start today" on the dashboard built a draft
// without warm-ups (store startFromProgram); it now goes through the same
// orchestrator path as /workout.
test('starting today\'s program session from the dashboard generates warm-ups, as /workout does', async ({ page, tytax }) => {
  await tytax.gotoApp('/dashboard');
  await tytax.reset();
  const profile = await tytax.seedProfile({ name: 'Dash start', settings: { warmupStrategy: 'standard' } });
  await tytax.seedHistory(profile.id, [
    { daysAgo: 2, sessionName: 'Seeded Upper', exercises: [{ exerciseId: BENCH_ID, exerciseName: BENCH_NAME, sets: [{ kg: 100, reps: 8, rir: 3 }] }] },
  ]);
  await tytax.seedProgram(profile.id, {
    template: {
      name: 'Bench Day',
      splitType: 'custom',
      frequency: 1,
      periodizationType: 'none',
      sessionOrder: ['Bench'],
      sessions: [
        { id: 's-bench', programId: '', name: 'Bench', dayIndex: 0, exercises: [{ exerciseId: BENCH_ID, exerciseName: BENCH_NAME, modality: 'tytax', sets: 1, reps: '8' }] },
      ],
      modalitiesUsed: ['tytax'],
      isPreset: false,
      currentSessionIndex: 0,
    },
  });

  await tytax.gotoApp('/dashboard');
  await expect(page.getByTestId('dash-session-name')).toContainText('Bench');
  await page.getByTestId('dash-start-session').click();
  await expect(page).toHaveURL(/\/workout\/active$/);
  const bench = page.getByTestId('session-exercise').first();
  await expect(bench).toHaveAttribute('data-exercise-id', BENCH_ID);
  // Standard ladder on the 102.5 kg prefill: warm-ups first, then the working set.
  await expect(bench.locator(warmup)).not.toHaveCount(0);
  await expect(bench.locator(working).getByTestId('set-kg')).toHaveValue('102.5');
  await expect(bench.getByTestId('set-row').last()).toHaveAttribute('data-set-type', 'working');
});
