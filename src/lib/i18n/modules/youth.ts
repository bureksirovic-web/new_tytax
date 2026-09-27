// Both locales of the youth module, for tests and tooling. App code imports
// the per-locale files (youth.en.ts / youth.hr.ts) so that only the active
// locale's strings are in first-load JS (see src/lib/i18n/index.ts).
export { youthEn } from './youth.en';
export { youthHr } from './youth.hr';
