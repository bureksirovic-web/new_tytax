// Both locales of the programs module, for tests and tooling. App code imports
// the per-locale files (programs.en.ts / programs.hr.ts) so that only the active
// locale's strings are in first-load JS (see src/lib/i18n/index.ts).
export { programsEn } from './programs.en';
export { programsHr } from './programs.hr';
