// Both locales of the exercises module, for tests and tooling. App code imports
// the per-locale files (exercises.en.ts / exercises.hr.ts) so that only the active
// locale's strings are in first-load JS (see src/lib/i18n/index.ts).
export { exercisesEn } from './exercises.en';
export { exercisesHr } from './exercises.hr';
