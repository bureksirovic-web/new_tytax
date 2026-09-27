'use client';
import { useCallback } from 'react';
import { useLocale } from '@/components/providers';
import { interpolate, type TranslationKey, type TranslationVars } from '.';

/**
 * Translation hook for G4 screens: `t(key, vars?)` with `{name}` interpolation.
 * Works with the current LocaleProvider and with the one proposed in
 * docs/v2/requests/G4-01 (which interpolates itself; interpolating twice is a no-op).
 */
export function useT() {
  const { t, locale, setLocale } = useLocale();
  const tt = useCallback(
    (key: TranslationKey, vars?: TranslationVars) => interpolate(t(key), vars),
    [t]
  );
  return { t: tt, locale, setLocale };
}
