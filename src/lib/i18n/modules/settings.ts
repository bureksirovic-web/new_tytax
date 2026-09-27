// Both locales of the settings module, for tests and tooling. App code imports
// the per-locale files (settings.en.ts / settings.hr.ts) so that only the active
// locale's strings are in first-load JS (see src/lib/i18n/index.ts).
export { settingsEn } from './settings.en';
export { settingsHr } from './settings.hr';
