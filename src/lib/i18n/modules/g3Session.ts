// Both locales of the g3Session module, for tests and tooling. App code imports
// the per-locale files (g3Session.en.ts / g3Session.hr.ts) so that only the active
// locale's strings are in first-load JS (see src/lib/i18n/index.ts).
export { g3SessionEn } from './g3Session.en';
export { g3SessionHr } from './g3Session.hr';
