// Both locales of the g3Tools module, for tests and tooling. App code imports
// the per-locale files (g3Tools.en.ts / g3Tools.hr.ts) so that only the active
// locale's strings are in first-load JS (see src/lib/i18n/index.ts).
export { g3ToolsEn } from './g3Tools.en';
export { g3ToolsHr } from './g3Tools.hr';
