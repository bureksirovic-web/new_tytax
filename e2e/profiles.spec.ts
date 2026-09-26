import type { Page } from 'playwright-core';
import { test, expect, type Profile, type SeedLogInput, type TytaxFixture } from './fixtures';

/**
 * AC9 (persistence): two family profiles are isolated, and deleting one wipes
 * only its data. Profile switch/remove go through `window.__tytaxRepo` (the
 * app repository, exposed outside production by src/lib/db/index.ts) until
 * `E2EHooks` gains them (docs/v2/requests/G2-01.md).
 */

const BENCH_ID = 'tytax_smith-machine_smith-flat-bench-press';
const SQUAT_ID = 'tytax_smith-machine_smith-back-squat';

const A_SESSIONS = ['Alpha Push Day', 'Alpha Leg Day'] as const;
const B_SESSIONS = ['Bravo Pull Day', 'Bravo Squat Day', 'Bravo Bench Day'] as const;

function logs(names: readonly string[], exerciseId: string): SeedLogInput[] {
  return names.map((sessionName, i) => ({
    daysAgo: i + 1,
    sessionName,
    exercises: [{ exerciseId, sets: [{ kg: 40 + i * 5, reps: 8, rir: 2 }] }],
  }));
}

const MISSING_REPO = 'window.__tytaxRepo is missing: serve a dev build or one built with NEXT_PUBLIC_E2E_HOOKS=1';

async function setActive(page: Page, id: string): Promise<void> {
  await page.evaluate(
    async ({ id: pid, missing }) => {
      if (window.__tytaxRepo === undefined) throw new Error(missing);
      await window.__tytaxRepo.profiles.setActive(pid);
    },
    { id, missing: MISSING_REPO },
  );
}

async function removeProfile(page: Page, id: string): Promise<void> {
  await page.evaluate(
    async ({ id: pid, missing }) => {
      if (window.__tytaxRepo === undefined) throw new Error(missing);
      await window.__tytaxRepo.profiles.remove(pid);
    },
    { id, missing: MISSING_REPO },
  );
}

async function profileIds(page: Page): Promise<string[]> {
  return page.evaluate(async (missing) => {
    if (window.__tytaxRepo === undefined) throw new Error(missing);
    return (await window.__tytaxRepo.profiles.list()).map((p) => p.id);
  }, MISSING_REPO);
}

/** Fresh app with exactly two profiles, A (active) and B, each with its own history. */
async function seedTwoProfiles(page: Page, tytax: TytaxFixture): Promise<{ a: Profile; b: Profile }> {
  await tytax.gotoApp('/history');
  await tytax.reset();
  const { activeProfileId: firstRun } = await tytax.snapshot();
  expect(firstRun).toEqual(expect.any(String));
  const a = await tytax.seedProfile({ name: 'Alpha', activate: true });
  const b = await tytax.seedProfile({ name: 'Bravo', activate: false });
  // Drop the first-run profile so A and B are the only ones on the device.
  if (firstRun !== null) await removeProfile(page, firstRun);
  await tytax.seedHistory(a.id, logs(A_SESSIONS, BENCH_ID));
  await tytax.seedHistory(b.id, logs(B_SESSIONS, SQUAT_ID));
  return { a, b };
}

async function expectHistoryShows(page: Page, shown: readonly string[], hidden: readonly string[]): Promise<void> {
  const items = page.getByTestId('history-item');
  await expect(items).toHaveCount(shown.length);
  // Newest first: the seeds use daysAgo 1, 2, 3 in list order.
  await expect(items.locator('p').first()).toHaveText(shown[0]);
  for (const name of shown) await expect(page.getByTestId('history-list')).toContainText(name);
  for (const name of hidden) await expect(page.getByTestId('history-list')).not.toContainText(name);
}

test('two profiles see only their own history; switching swaps it', async ({ page, tytax }) => {
  const { a, b } = await seedTwoProfiles(page, tytax);
  expect(await profileIds(page)).toEqual([a.id, b.id]);

  await tytax.gotoApp('/history');
  await expectHistoryShows(page, A_SESSIONS, B_SESSIONS);
  expect((await tytax.snapshot()).activeProfileId).toBe(a.id);

  await setActive(page, b.id);
  await page.reload();
  await expectHistoryShows(page, B_SESSIONS, A_SESSIONS);
  expect((await tytax.snapshot()).activeProfileId).toBe(b.id);
});

test('deleting a profile wipes only its data and hands over to the other', async ({ page, tytax }) => {
  const { a, b } = await seedTwoProfiles(page, tytax);
  // 2 and 3: the logs seeded for A and B.
  expect(await tytax.listLogs(a.id)).toHaveLength(A_SESSIONS.length);
  const bBefore = await tytax.listLogs(b.id);
  expect(bBefore).toHaveLength(B_SESSIONS.length);

  await removeProfile(page, a.id);
  await page.reload();
  await page.waitForFunction(() => window.__tytaxE2E?.ready === true);

  const bAfter = await tytax.listLogs(b.id);
  // 3: every one of B's logs survives A's deletion, unchanged.
  expect(bAfter).toHaveLength(B_SESSIONS.length);
  expect(bAfter.map((l) => [l.id, l.sessionName, l.totalVolumeKg])).toEqual(
    bBefore.map((l) => [l.id, l.sessionName, l.totalVolumeKg]),
  );
  // 0: A's logs are gone with it.
  expect(await tytax.listLogs(a.id)).toHaveLength(0);
  expect(await profileIds(page)).toEqual([b.id]);
  // A was active; B is the only profile left, so it becomes active.
  expect((await tytax.snapshot()).activeProfileId).toBe(b.id);

  await expectHistoryShows(page, B_SESSIONS, A_SESSIONS);
});
