import { en } from './en';
import { hr } from './hr';
import { DEFAULT_LOCALE, interpolate, type Dictionary } from '.';
import type { Locale, TranslationKey, TranslationVars } from './types';

/**
 * Every locale's dictionary, imported statically. For server components
 * (page metadata) and tests only: a client module that imports this file puts
 * the English dictionary back into first-load JS (`npm run check-bundle`).
 * Client code uses `t()` from `@/lib/i18n`, which loads non-default locales
 * lazily.
 */
export const translations: Record<Locale, Dictionary> = { hr, en };

/** Same contract as `t()` in `@/lib/i18n`, with every locale always available. */
export function t(key: TranslationKey, locale: Locale = DEFAULT_LOCALE, vars?: TranslationVars): string {
  const text = translations[locale]?.[key] ?? translations[DEFAULT_LOCALE][key] ?? (key as string);
  return interpolate(text, vars);
}
