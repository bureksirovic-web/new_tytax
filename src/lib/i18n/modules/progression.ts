// Both locales of the progression module, for tests and tooling. App code
// imports the per-locale files (progression.en.ts / progression.hr.ts) so
// only the active locale's strings are in first-load JS (see src/lib/i18n/index.ts).
export { progressionEn } from './progression.en';
export { progressionHr } from './progression.hr';
