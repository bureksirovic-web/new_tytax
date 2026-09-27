// Both locales of the g5Auth module, for tests and tooling. App code imports
// the per-locale files (g5Auth.en.ts / g5Auth.hr.ts) so that only the active
// locale's strings are in first-load JS (see src/lib/i18n/index.ts).
export { g5AuthEn } from './g5Auth.en';
export { g5AuthHr } from './g5Auth.hr';
