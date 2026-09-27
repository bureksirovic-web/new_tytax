'use client';
import { useLocale } from '@/components/providers';

/**
 * G3 local string tables until G4's dictionary absorbs them
 * (keys are listed in docs/v2/requests/G3-i18n.md). Each area keeps its own
 * `{ en, hr }` table with identical keys and gets a typed hook from here.
 */
export type StringTable<K extends string> = { readonly en: Record<K, string>; readonly hr: Record<K, string> };

/** `{name}` placeholders are replaced from `vars`. */
export function format(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

export function makeStringsHook<K extends string>(table: StringTable<K>) {
  return function useStrings(): (key: K, vars?: Record<string, string | number>) => string {
    const { locale } = useLocale();
    const t = locale === 'hr' ? table.hr : table.en;
    return (key, vars) => format(t[key], vars);
  };
}
