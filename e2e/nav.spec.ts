import { test, expect } from './fixtures';
import { APP_ROUTES } from './routes';

/**
 * AC11 (navigation): every route in e2e/routes.ts answers 200, renders its
 * heading, shows no error boundary and is linked from the navigation; every
 * navigation link points at a listed route (no dead links).
 */

const EXTRA_NAV_HREFS = ['/exercises?favorites=1', '/auth/login'];
const pathOf = (href: string) => new URL(href, 'http://x').pathname;

test.beforeEach(async ({ tytax }) => {
  await tytax.gotoApp('/dashboard');
  await tytax.reset();
});

for (const route of APP_ROUTES) {
  test(`${route.path} answers 200 and renders its heading`, async ({ page, tytax }) => {
    const response = await page.request.get(route.path);
    expect(response.status()).toBe(200);

    await tytax.gotoApp(route.path);
    await expect(page.getByTestId(route.headingTestId)).toBeVisible();
    await expect(page.getByTestId('error-boundary')).toHaveCount(0);
    await expect(page.getByTestId('not-found')).toHaveCount(0);
  });
}

test('every listed route is linked from the navigation', async ({ page, isMobile }) => {
  if (isMobile) {
    await page.getByRole('button', { name: /više|more/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
  }
  const hrefs = await page
    .locator('[data-app-nav] a[href]')
    .evaluateAll((els) => els.map((el) => el.getAttribute('href') ?? ''));
  const linkedPaths = new Set(hrefs.map(pathOf));

  expect(hrefs.length).toBeGreaterThanOrEqual(APP_ROUTES.length);
  for (const route of APP_ROUTES) {
    expect(linkedPaths, `nav link to ${route.path}`).toContain(route.path);
  }
});

test('no navigation link is dead', async ({ page, isMobile }) => {
  if (isMobile) {
    await page.getByRole('button', { name: /više|more/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
  }
  const hrefs = await page
    .locator('[data-app-nav] a[href]')
    .evaluateAll((els) => [...new Set(els.map((el) => el.getAttribute('href') ?? ''))]);
  const allowed = new Set([...APP_ROUTES.map((r) => r.path), ...EXTRA_NAV_HREFS.map(pathOf)]);

  expect(hrefs.length).toBeGreaterThan(0);
  for (const href of hrefs) {
    expect(allowed, `unlisted nav href ${href}`).toContain(pathOf(href));
    const res = await page.request.get(href);
    expect(res.status(), `status of ${href}`).toBe(200);
  }
});

test('clicking a nav link navigates client-side to the screen', async ({ page, isMobile }) => {
  if (isMobile) {
    await page.getByRole('button', { name: /više|more/i }).click();
    await page.getByRole('dialog').getByRole('link', { name: /postavke|settings/i }).click();
  } else {
    await page.locator('nav').getByRole('link', { name: /postavke|settings/i }).first().click();
  }
  await expect(page).toHaveURL(/\/settings$/);
  await expect(page.getByTestId('page-heading-settings')).toBeVisible();
  await expect(page.getByTestId('error-boundary')).toHaveCount(0);
});
