// Both locales of the shared module, for tests and tooling. App code imports
// the per-locale files (shared.en.ts / shared.hr.ts) so that only the active
// locale's strings are in first-load JS (see src/lib/i18n/index.ts).
export { sharedEn } from './shared.en';
export { sharedHr } from './shared.hr';
