// Both locales of the setup module, for tests and tooling. App code imports
// the per-locale files (setup.en.ts / setup.hr.ts) so that only the active
// locale's strings are in first-load JS (see src/lib/i18n/index.ts).
export { setupEn } from './setup.en';
export { setupHr } from './setup.hr';
