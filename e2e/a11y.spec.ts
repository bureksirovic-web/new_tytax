import AxeBuilder from '@axe-core/playwright';
import { test, expect } from './fixtures';

/**
 * AC14 (a11y): axe finds no serious or critical violations on the five core
 * pages, with data present (a seeded profile, program and history) so the
 * real widgets render, not just empty states.
 */

const PAGES = [
  { path: '/dashboard', heading: 'page-heading-dashboard' },
  { path: '/workout', heading: 'page-heading-workout' },
  { path: '/exercises', heading: 'page-heading-exercises' },
  { path: '/history', heading: 'page-heading-history' },
  { path: '/settings', heading: 'page-heading-settings' },
] as const;

const BENCH_ID = 'tytax_smith-machine_smith-flat-bench-press';

test.beforeEach(async ({ tytax }) => {
  await tytax.gotoApp('/dashboard');
  await tytax.reset();
  const profile = await tytax.seedProfile({ name: 'Ana' });
  await tytax.seedHistory(profile.id, [
    {
      daysAgo: 2,
      exercises: [{ exerciseId: BENCH_ID, sets: [{ kg: 60, reps: 8, rir: 2 }, { kg: 62.5, reps: 8, rir: 2 }] }],
    },
  ]);
});

for (const target of PAGES) {
  test(`${target.path} has no serious axe violations`, async ({ page, tytax }) => {
    await tytax.gotoApp(target.path);
    await expect(page.getByTestId(target.heading)).toBeVisible();

    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    const serious = results.violations
      .filter((v) => v.impact === 'serious' || v.impact === 'critical')
      .map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(' | ')}`);

    expect(serious).toEqual([]);
    expect(results.passes.length).toBeGreaterThan(0);
  });
}

test('pinch zoom is allowed and the document language is set', async ({ page, tytax }) => {
  await tytax.gotoApp('/dashboard');
  const viewport = await page.locator('meta[name="viewport"]').getAttribute('content');
  expect(viewport).not.toMatch(/user-scalable\s*=\s*(no|0)/i);
  expect(viewport).not.toMatch(/maximum-scale\s*=\s*1(\.0)?\b/i);
  await expect(page.locator('html')).toHaveAttribute('lang', /^(hr|en)$/);
});

// Wave 2: axe on the remaining G4 screens, with data, including detail pages.
test('secondary G4 screens have no serious axe violations', async ({ page, tytax }) => {
  test.setTimeout(120_000);
  const { activeProfileId } = await tytax.snapshot();
  const [log] = await tytax.listLogs(activeProfileId!);
  expect(log).toBeDefined();

  const targets = [
    { path: '/programs', heading: 'page-heading-programs' },
    { path: '/analytics', heading: 'page-heading-analytics' },
    { path: `/analytics/${BENCH_ID}`, heading: 'page-heading-analytics-exercise' },
    { path: `/exercises/${BENCH_ID}`, heading: 'page-heading-exercise-detail' },
    { path: `/history/${log.id}`, heading: 'page-heading-history-detail' },
    { path: `/history/${log.id}/edit`, heading: 'page-heading-history-edit' },
  ];
  const problems: string[] = [];
  for (const target of targets) {
    await tytax.gotoApp(target.path);
    await expect(page.getByTestId(target.heading)).toBeVisible();
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    for (const v of results.violations) {
      if (v.impact === 'serious' || v.impact === 'critical') {
        problems.push(`${target.path} ${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(' | ')}`);
      }
    }
  }
  expect(problems).toEqual([]);
});
