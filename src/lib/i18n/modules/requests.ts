// Both locales of the requests module, for tests and tooling. App code imports
// the per-locale files (requests.en.ts / requests.hr.ts) so that only the active
// locale's strings are in first-load JS (see src/lib/i18n/index.ts).
export { requestsEn } from './requests.en';
export { requestsHr } from './requests.hr';
