import { test, expect } from './fixtures';

/**
 * The `tytax` profile fixture methods (G2-01): setActiveProfile, removeProfile
 * and listProfiles run in the page through `window.__tytaxE2E`, against the
 * app's real repository.
 */
test('tytax fixture switches and removes profiles through the app repository', async ({ tytax }) => {
  await tytax.gotoApp('/dashboard');
  await tytax.reset();

  const first = await tytax.seedProfile({ name: 'Fixture A' });
  const second = await tytax.seedProfile({ name: 'Fixture B', activate: false });
  await tytax.seedHistory(second.id, [{ daysAgo: 1, exercises: [{ exerciseId: 'ex-1', sets: [{ kg: 50, reps: 5 }] }] }]);
  expect((await tytax.snapshot()).activeProfileId).toBe(first.id);

  await tytax.setActiveProfile(second.id);
  expect((await tytax.snapshot()).activeProfileId).toBe(second.id);

  // 3: reset() re-created the default profile, then A and B were seeded.
  const names = (await tytax.listProfiles()).map((p) => p.name);
  expect(names).toHaveLength(3);
  expect(names).toEqual(expect.arrayContaining(['Fixture A', 'Fixture B']));

  await tytax.removeProfile(second.id);
  const remaining = (await tytax.listProfiles()).map((p) => p.id);
  expect(remaining).not.toContain(second.id);
  expect(remaining).toContain(first.id);
  // 0: B's one seeded log went with it.
  expect(await tytax.listLogs(second.id)).toHaveLength(0);
});
