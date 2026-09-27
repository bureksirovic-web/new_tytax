import { en } from './en';
import { hr } from './hr';
import type { Locale, TranslationKey, TranslationVars } from './types';

export type { Locale, TranslationKey, TranslationVars } from './types';
export { formatWeight, formatDate, toDisplayWeight, fromDisplayWeight, type WeightUnit } from './format';

export const DEFAULT_LOCALE: Locale = 'hr';
export const LOCALE_STORAGE_KEY = 'locale';

export const LOCALES: Record<Locale, string> = {
  hr: 'Hrvatski',
  en: 'English',
};

export const translations: Record<Locale, Record<TranslationKey, string>> = { hr, en };

export function isLocale(value: unknown): value is Locale {
  return value === 'hr' || value === 'en';
}

/** Replace `{name}` placeholders; unknown placeholders are left intact. */
export function interpolate(template: string, vars?: TranslationVars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : match
  );
}

/**
 * Translate `key` into `locale` (hr by default). Falls back to English, then
 * to the key itself, so a missing string is visible rather than blank.
 */
export function t(key: TranslationKey, locale: Locale = DEFAULT_LOCALE, vars?: TranslationVars): string {
  const text = translations[locale]?.[key] ?? translations.en[key] ?? (key as string);
  return interpolate(text, vars);
}

/** Read the persisted locale; anything unknown or unreadable yields the default. */
export function readStoredLocale(storage: Pick<Storage, 'getItem'> | undefined): Locale {
  try {
    const saved = storage?.getItem(LOCALE_STORAGE_KEY);
    return isLocale(saved) ? saved : DEFAULT_LOCALE;
  } catch {
    return DEFAULT_LOCALE;
  }
}
