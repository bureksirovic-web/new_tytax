/**
 * Locale helpers for the provider, its tests and the e2e fixtures. Formerly an
 * integration shim mirroring G4's `src/lib/i18n` (with an 'en' default); since
 * the v2-g5 merge it re-exports G4's module unchanged, so DEFAULT_LOCALE is 'hr'
 * (D3/AC14) and there is one dictionary lookup.
 */
export {
  DEFAULT_LOCALE,
  LOCALE_STORAGE_KEY,
  isLocale,
  isLocaleLoaded,
  loadLocale,
  subscribeLocales,
  interpolate,
  readStoredLocale,
  t as translate,
  type TranslationVars,
} from '@/lib/i18n';
