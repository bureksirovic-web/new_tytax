'use client';
import { useEffect } from 'react';
import { useActiveProfile } from '@/hooks/use-repo';
import { useApplyProfilePrefs } from '@/components/settings/use-apply-profile-prefs';

/**
 * Applies the active profile's language and theme whenever the app boots or
 * the active profile (or its settings) changes. Profiles default to hr, so this
 * is what makes Croatian the default UI language.
 */
export function ProfilePrefsSync() {
  const { profile } = useActiveProfile();
  const apply = useApplyProfilePrefs();
  const language = profile?.settings.language;
  const theme = profile?.settings.theme;

  useEffect(() => {
    if (profile) apply(profile);
    // Re-apply only when the values themselves change, not on every live-query emission.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id, language, theme, apply]);

  return null;
}
