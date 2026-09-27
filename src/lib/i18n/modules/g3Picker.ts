// Both locales of the g3Picker module, for tests and tooling. App code imports
// the per-locale files (g3Picker.en.ts / g3Picker.hr.ts) so that only the active
// locale's strings are in first-load JS (see src/lib/i18n/index.ts).
export { g3PickerEn } from './g3Picker.en';
export { g3PickerHr } from './g3Picker.hr';
