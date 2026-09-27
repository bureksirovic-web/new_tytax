'use client';
import { useCallback } from 'react';
import { useLocale } from '@/components/providers/locale-provider';
import type { TranslationKey } from '@/lib/i18n';
import { translateAuth, type AuthKey } from './i18n';

/**
 * Translation hook for G5 screens; see ./i18n.ts for the fallback rule.
 * No hydration guard is needed: LocaleProvider renders DEFAULT_LOCALE on the
 * server and on the first client pass, and adopts the saved locale in an
 * effect, so both passes resolve the same strings.
 */
export function useAuthT() {
  const { t, locale } = useLocale();
  return useCallback(
    // The auth keys are pending in G5-i18n.md; the cast is harmless once merged.
    (key: AuthKey) => translateAuth(key, locale, (k) => t(k as TranslationKey)),
    [t, locale]
  );
}
