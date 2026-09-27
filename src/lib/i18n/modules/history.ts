// Both locales of the history module, for tests and tooling. App code imports
// the per-locale files (history.en.ts / history.hr.ts) so that only the active
// locale's strings are in first-load JS (see src/lib/i18n/index.ts).
export { historyEn } from './history.en';
export { historyHr } from './history.hr';
