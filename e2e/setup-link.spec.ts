import { encodeSetupPayload, type SetupPayload } from '../src/lib/setup-link';
import { test, expect, type Page } from './fixtures';

/**
 * AC3 / AC9 (family-profiles plan, Piece 1): opening a setup link previews its
 * profiles, "Create" installs each one's preset and activates the first
 * profile, reopening the same link reports every profile skipped, the
 * fragment is cleared immediately (history.replaceState, not pushState), and
 * Cancel or an invalid link writes nothing.
 *
 * Two SYNTHETIC profiles only (no real family data): "Ana" on the balanced
 * TYTAX split, "Leo" (age 11) on the bodyweight fundamentals preset. The
 * youth preset itself is Piece 2/3's; this spec does not depend on it.
 */
type SetupProfileInput = SetupPayload['profiles'][number];

const CURRENT_YEAR = new Date().getFullYear();

const ANA: SetupProfileInput = { name: 'Ana', presetId: 'tytax-balanced-6day' };
const LEO: SetupProfileInput = { name: 'Leo', birthYear: CURRENT_YEAR - 11, presetId: 'bw-fundamentals' };

function setupLink(profiles: readonly SetupProfileInput[] = [ANA, LEO]): string {
  return `/setup#p=${encodeSetupPayload({ v: 1, profiles })}`;
}

/** The presetId of `profileId`'s active program, read through the app repository. */
async function activePresetId(page: Page, profileId: string): Promise<string | undefined> {
  return page.evaluate(async (id) => {
    const repo = window.__tytaxRepo;
    if (!repo) throw new Error('window.__tytaxRepo missing: serve a build with NEXT_PUBLIC_E2E_HOOKS=1');
    return (await repo.programs.getActive(id))?.presetId;
  }, profileId);
}

test('fresh device: preview, create, and the profile switcher shows exactly the setup profiles', async ({ page, tytax }) => {
  await tytax.gotoApp(setupLink());

  const previewRows = page.getByTestId('setup-preview-row');
  await expect(previewRows).toHaveCount(2);
  await expect(previewRows.nth(0)).toContainText('Ana');
  await expect(previewRows.nth(1)).toContainText('Leo');
  await expect(previewRows.nth(1)).toContainText('11');

  await page.getByTestId('setup-create').click();
  await expect(page.locator('[data-testid^="setup-result-row-"]')).toHaveCount(2);
  await expect(page.getByTestId('setup-go-dashboard')).toBeVisible();

  await tytax.gotoApp('/settings');
  await expect(page.getByTestId('settings-profile-list').locator('li')).toHaveCount(2);

  const profiles = await tytax.listProfiles();
  expect(profiles.map((p) => p.name).sort()).toEqual(['Ana', 'Leo']);
  const ana = profiles.find((p) => p.name === 'Ana')!;
  const leo = profiles.find((p) => p.name === 'Leo')!;
  expect(await activePresetId(page, ana.id)).toBe('tytax-balanced-6day');
  expect(await activePresetId(page, leo.id)).toBe('bw-fundamentals');

  // AC3: each created profile's dashboard shows its own program's next session.
  await tytax.gotoApp('/dashboard');
  await expect(page.getByTestId('dash-session-name')).toContainText('Upper A'); // Ana is active (first in payload)
  await tytax.setActiveProfile(leo.id);
  await tytax.gotoApp('/dashboard');
  await expect(page.getByTestId('dash-session-name')).toContainText('Full Body A');
  await tytax.setActiveProfile(ana.id);
  await tytax.gotoApp('/dashboard');
  await expect(page.getByTestId('dash-session-name')).toContainText('Upper A');
});

test('reopening the same link reports every profile skipped and creates nothing new', async ({ page, tytax }) => {
  const link = setupLink();

  await tytax.gotoApp(link);
  await expect(page.getByTestId('setup-preview-row')).toHaveCount(2);
  await page.getByTestId('setup-create').click();
  await expect(page.locator('[data-testid^="setup-result-row-"]')).toHaveCount(2);
  expect(await tytax.listProfiles()).toHaveLength(2);

  // A real reopen of the link: navigate away first (Playwright, like a
  // browser, treats two goto()s that differ only in fragment as a
  // same-document navigation and never remounts the page).
  await tytax.gotoApp('/dashboard');
  await tytax.gotoApp(link);
  await expect(page.getByTestId('setup-preview-row')).toHaveCount(2);
  await page.getByTestId('setup-create').click();

  await expect(page.locator('[data-testid="setup-result-row-skipped"]')).toHaveCount(2);
  await expect(page.locator('[data-testid^="setup-result-row-"]')).toHaveCount(2);
  expect(await tytax.listProfiles()).toHaveLength(2);
});

test('the fragment is cleared immediately (replaceState, not pushState)', async ({ page, tytax }) => {
  await page.goto('about:blank');
  const before = await page.evaluate(() => window.history.length);

  await tytax.gotoApp(setupLink());
  await expect(page.getByTestId('setup-preview')).toBeVisible();

  await expect(page).toHaveURL(/\/setup$/);
  const url = page.url();
  expect(url).not.toContain('#');

  const after = await page.evaluate(() => window.history.length);
  // +1 for the navigation itself; a second entry would mean the clearing used
  // pushState instead of replaceState.
  expect(after).toBe(before + 1);
});

test('cancel and an invalid link write nothing', async ({ page, tytax }) => {
  await tytax.gotoApp('/settings');
  const baseline = (await tytax.listProfiles()).length;

  await tytax.gotoApp(setupLink());
  await expect(page.getByTestId('setup-preview')).toBeVisible();
  await page.getByTestId('setup-cancel').click();
  await expect(page.getByTestId('setup-cancelled')).toBeVisible();
  expect(await tytax.listProfiles()).toHaveLength(baseline);

  // Navigate away first: see the comment in the "reopening" test above.
  await tytax.gotoApp('/dashboard');
  await tytax.gotoApp('/setup#p=not-a-valid-payload!!');
  await expect(page.getByTestId('setup-invalid')).toBeVisible();
  expect(await tytax.listProfiles()).toHaveLength(baseline);
});
