'use client';
import { useLocale } from '@/components/providers';
import { t as translate, type TranslationKey } from '@/lib/i18n';

/**
 * G3 string hooks, backed by the shared dictionary (`src/lib/i18n`, modules
 * g3Tools/g3Picker/g3Workout/g3Session; switch requested in
 * docs/v2/requests/G4-W2-01-i18n-switch.md). Each area keeps its typed key
 * union; its `{ en, hr }` table stays as the reviewed source that
 * `src/lib/i18n/__tests__/requests.test.ts` checks against the dictionary,
 * but the hooks no longer read it at runtime.
 */
export type StringTable<K extends string> = { readonly en: Record<K, string>; readonly hr: Record<K, string> };

/** `{name}` placeholders are replaced from `vars`. */
export function format(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

/**
 * A `t(key, vars?)` hook for one key union, resolved in the dictionary for the
 * current locale. Uses the plain `t` from `@/lib/i18n` (not the provider's
 * context `t`), so it also works outside `<LocaleProvider>`.
 */
export function makeStringsHook<K extends string>() {
  return function useStrings(): (key: K, vars?: Record<string, string | number>) => string {
    const { locale } = useLocale();
    return (key, vars) => translate(key as TranslationKey, locale, vars);
  };
}
