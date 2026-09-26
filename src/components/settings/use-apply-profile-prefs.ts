'use client';
import { useCallback } from 'react';
import type { Profile } from '@/contracts/domain';
import { useTheme } from '@/components/providers';
import { useT } from '@/lib/i18n/use-t';
import { toProviderTheme } from './settings-utils';

/** Applies a profile's language and theme to the providers at once (no reload). */
export function useApplyProfilePrefs(): (profile: Profile) => void {
  const { setLocale } = useT();
  const { setTheme } = useTheme();
  return useCallback(
    (profile: Profile) => {
      setLocale(profile.settings.language);
      setTheme(toProviderTheme(profile.settings.theme));
    },
    [setLocale, setTheme],
  );
}
