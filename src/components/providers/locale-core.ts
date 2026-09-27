/**
 * INTEGRATION SHIM. G4's `src/lib/i18n` (branch v2-g4) exports DEFAULT_LOCALE,
 * LOCALE_STORAGE_KEY, isLocale, interpolate, readStoredLocale, TranslationVars
 * and `t(key, locale, vars)`; this worktree's copy does not yet. This file
 * mirrors g4 src/lib/i18n/index.ts (lines 8-47) under the same names.
 *
 * At integration replace the whole body with
 *   export { DEFAULT_LOCALE, LOCALE_STORAGE_KEY, isLocale, interpolate,
 *     readStoredLocale, t as translate, type TranslationVars } from '@/lib/i18n';
 * so every importer (provider, tests, e2e) picks up G4's values unchanged.
 */
import { translations, type Locale, type TranslationKey } from '@/lib/i18n';

export type TranslationVars = Record<string, string | number>;

/**
 * 'en' only in this worktree: its dictionary and the G1-G4 tests merged here
 * still assume English. G4's module sets 'hr' (D3/AC14); tests that depend on
 * the default read this constant instead of hard-coding a language.
 */
export const DEFAULT_LOCALE: Locale = 'en';
export const LOCALE_STORAGE_KEY = 'locale';

export function isLocale(value: unknown): value is Locale {
  return value === 'hr' || value === 'en';
}

/** Replace `{name}` with `vars.name`; unknown placeholders stay visible. */
export function interpolate(template: string, vars?: TranslationVars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : match
  );
}

/** Translate into `locale`; falls back to English, then to the key itself. */
export function translate(key: TranslationKey, locale: Locale = DEFAULT_LOCALE, vars?: TranslationVars): string {
  const text = translations[locale]?.[key] ?? translations.en[key] ?? (key as string);
  return interpolate(text, vars);
}

/** The persisted locale; anything unknown or unreadable yields the default. */
export function readStoredLocale(storage: Pick<Storage, 'getItem'> | undefined): Locale {
  try {
    const saved = storage?.getItem(LOCALE_STORAGE_KEY);
    return isLocale(saved) ? saved : DEFAULT_LOCALE;
  } catch {
    return DEFAULT_LOCALE;
  }
}
