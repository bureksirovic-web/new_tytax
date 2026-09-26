/**
 * Explicit list of top-level app routes (AC11). e2e/nav.spec.ts asserts that each
 * one is linked from the navigation, answers HTTP 200, renders the heading with
 * `data-testid={headingTestId}` and shows no error boundary.
 * Adding a screen = adding it here; a nav link to anything not listed fails the spec.
 */
export interface AppRoute {
  path: string;
  headingTestId: string;
  /** Linked from the primary nav (bottom bar / sidebar) or only from the "more" drawer. */
  nav: 'primary' | 'more';
}

export const APP_ROUTES: readonly AppRoute[] = [
  { path: '/dashboard', headingTestId: 'page-heading-dashboard', nav: 'primary' },
  { path: '/workout', headingTestId: 'page-heading-workout', nav: 'primary' },
  { path: '/exercises', headingTestId: 'page-heading-exercises', nav: 'primary' },
  { path: '/programs', headingTestId: 'page-heading-programs', nav: 'more' },
  { path: '/history', headingTestId: 'page-heading-history', nav: 'primary' },
  { path: '/analytics', headingTestId: 'page-heading-analytics', nav: 'more' },
  { path: '/settings', headingTestId: 'page-heading-settings', nav: 'more' },
  { path: '/tools/plate-calculator', headingTestId: 'page-heading-plate-calculator', nav: 'more' },
  { path: '/tools/rm-calculator', headingTestId: 'page-heading-rm-calculator', nav: 'more' },
] as const;
