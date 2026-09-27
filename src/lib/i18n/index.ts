import { coreHr } from './modules/core.hr';
import type { Locale, TranslationKey, TranslationVars } from './types';

export type { Locale, TranslationKey, TranslationVars } from './types';
export { formatWeight, formatDate, toDisplayWeight, fromDisplayWeight, type WeightUnit } from './format';

export const DEFAULT_LOCALE: Locale = 'hr';
export const LOCALE_STORAGE_KEY = 'locale';

export const LOCALES: Record<Locale, string> = {
  hr: 'Hrvatski',
  en: 'English',
};

export type Dictionary = Record<TranslationKey, string>;

/**
 * What ships in first-load JS is the smallest dictionary the first paint
 * needs, so `t()` stays synchronous:
 * - hr (DEFAULT_LOCALE, rendered by the server and the hydration pass): the
 *   core module (./modules/core.hr.ts) up front, plus one *pack* per screen
 *   module (./packs/<module>.ts). A file that uses a pack's keys imports that
 *   pack, so its route or lazy chunk registers the strings before the first
 *   render (checked by scripts/i18n-packs.ts in npm test).
 * - every other locale: one lazy chunk (`import()`), fetched by `loadLocale`
 *   when a user picks it or has it stored. The service worker precaches it
 *   (public/sw.js follows the chunk references in this module's loader code),
 *   so switching also works offline.
 * Server code that needs every string synchronously imports ./dictionaries.
 */
const hrStrings: Partial<Dictionary> = { ...coreHr };

const LOADERS: Record<Locale, () => Promise<Partial<Dictionary>>> = {
  hr: async () => hrStrings,
  en: () => import('./en').then((m) => m.en),
};

const loaded: Partial<Record<Locale, Partial<Dictionary>>> = { hr: hrStrings };
const pending = new Map<Locale, Promise<void>>();
const listeners = new Set<() => void>();

/**
 * Add hr strings of one module (called by ./packs/*). Runs while modules
 * evaluate, before anything renders, so it notifies nobody.
 */
export function registerPack(strings: Partial<Dictionary>): void {
  Object.assign(hrStrings, strings);
}

export function isLocale(value: unknown): value is Locale {
  return value === 'hr' || value === 'en';
}

/** Locales whose dictionary can be loaded (all of LOCALES). */
export const loadableLocales = (): Locale[] => Object.keys(LOADERS) as Locale[];

/** True once `locale`'s dictionary is available to the synchronous `t()`. */
export function isLocaleLoaded(locale: Locale): boolean {
  return loaded[locale] !== undefined;
}

/** Make a dictionary available synchronously (a loader, tests); merges into what is loaded. */
export function registerLocale(locale: Locale, dictionary: Partial<Dictionary>): void {
  const current = loaded[locale];
  if (current) Object.assign(current, dictionary);
  else loaded[locale] = { ...dictionary };
  for (const listener of [...listeners]) listener();
}

/**
 * Fetch `locale`'s dictionary chunk once; concurrent calls share one request.
 * A failed load (offline without a cached chunk) rejects and may be retried.
 */
export function loadLocale(locale: Locale): Promise<void> {
  if (isLocaleLoaded(locale)) return Promise.resolve();
  let p = pending.get(locale);
  if (!p) {
    p = LOADERS[locale]().then(
      (dictionary) => {
        pending.delete(locale);
        registerLocale(locale, dictionary);
      },
      (err: unknown) => {
        pending.delete(locale);
        throw err;
      }
    );
    pending.set(locale, p);
  }
  return p;
}

/** Called whenever a dictionary is registered (useSyncExternalStore subscribe). */
export function subscribeLocales(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Replace `{name}` placeholders; unknown placeholders are left intact. */
export function interpolate(template: string, vars?: TranslationVars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : match
  );
}

/**
 * Translate `key` into `locale` (hr by default). Synchronous: a locale whose
 * dictionary is not loaded yet falls back to the default locale (always
 * loaded), then to the key itself, so a missing string is visible rather than
 * blank. LocaleProvider only switches to a locale once it is loaded.
 */
export function t(key: TranslationKey, locale: Locale = DEFAULT_LOCALE, vars?: TranslationVars): string {
  const text = loaded[locale]?.[key] ?? loaded[DEFAULT_LOCALE]?.[key] ?? (key as string);
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
