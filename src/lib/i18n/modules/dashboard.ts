// Both locales of the dashboard module, for tests and tooling. App code imports
// the per-locale files (dashboard.en.ts / dashboard.hr.ts) so that only the active
// locale's strings are in first-load JS (see src/lib/i18n/index.ts).
export { dashboardEn } from './dashboard.en';
export { dashboardHr } from './dashboard.hr';
