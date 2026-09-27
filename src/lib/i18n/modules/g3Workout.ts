// Both locales of the g3Workout module, for tests and tooling. App code imports
// the per-locale files (g3Workout.en.ts / g3Workout.hr.ts) so that only the active
// locale's strings are in first-load JS (see src/lib/i18n/index.ts).
export { g3WorkoutEn } from './g3Workout.en';
export { g3WorkoutHr } from './g3Workout.hr';
