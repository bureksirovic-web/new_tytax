// Both locales of the analytics module, for tests and tooling. App code imports
// the per-locale files (analytics.en.ts / analytics.hr.ts) so that only the active
// locale's strings are in first-load JS (see src/lib/i18n/index.ts).
export { analyticsEn } from './analytics.en';
export { analyticsHr } from './analytics.hr';
