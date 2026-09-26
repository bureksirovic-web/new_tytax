'use client';
import { useCallback, useSyncExternalStore } from 'react';
import { useLocale } from '@/components/providers/locale-provider';
import type { TranslationKey } from '@/lib/i18n';
import { translateAuth, type AuthKey } from './i18n';

const noopSubscribe = () => () => {};

/**
 * false on the server and during hydration, true afterwards (and on client-only
 * mounts). The server has no saved locale, so it always renders 'en'.
 */
function useHydrated(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false
  );
}

/**
 * Translation hook for auth screens; see ./i18n.ts for the fallback rule.
 * Until hydration finishes it renders the server's locale ('en', no dictionary)
 * so a saved client locale (LocaleProvider reads localStorage in its initial
 * state) cannot cause a hydration mismatch; it then re-renders in that locale.
 */
export function useAuthT() {
  const { t, locale } = useLocale();
  const hydrated = useHydrated();
  return useCallback(
    (key: AuthKey) =>
      hydrated
        ? // The auth keys are pending in G5-i18n.md; the cast is harmless once merged.
          translateAuth(key, locale, (k) => t(k as TranslationKey))
        : translateAuth(key, 'en'),
    [t, locale, hydrated]
  );
}
