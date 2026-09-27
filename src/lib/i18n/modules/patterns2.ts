// Both locales of the patterns2 module, for tests and tooling. App code imports
// the per-locale files (patterns2.en.ts / patterns2.hr.ts) so that only the active
// locale's strings are in first-load JS (see src/lib/i18n/index.ts).
export { patterns2En } from './patterns2.en';
export { patterns2Hr } from './patterns2.hr';
