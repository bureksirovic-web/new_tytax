// Both locales of the patterns module, for tests and tooling. App code imports
// the per-locale files (patterns.en.ts / patterns.hr.ts) so that only the active
// locale's strings are in first-load JS (see src/lib/i18n/index.ts).
export { patternsEn } from './patterns.en';
export { patternsHr } from './patterns.hr';
