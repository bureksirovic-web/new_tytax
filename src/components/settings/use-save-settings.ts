'use client';
import { useCallback } from 'react';
import type { Profile, ProfileSettings } from '@/contracts/domain';
import { useRepo } from '@/hooks/use-repo';
import { useT } from '@/lib/i18n/use-t';
import { settingsRepairs } from './backup-validate';
import { notify } from './settings-utils';
import '@/lib/i18n/packs/settings';

const isValidation = (e: unknown) => typeof e === 'object' && e !== null && (e as { code?: unknown }).code === 'VALIDATION';

/**
 * Persists a settings patch for `profile` immediately; toasts only on error.
 * Missing or invalid stored keys (an old restore) are repaired with defaults in
 * the same write, so a damaged profile never blocks every setting.
 */
export function useSaveSettings(profile: Profile): (patch: Partial<ProfileSettings>) => Promise<void> {
  const repo = useRepo();
  const { t } = useT();
  const id = profile.id;
  const settings = profile.settings;
  return useCallback(
    async (patch: Partial<ProfileSettings>) => {
      try {
        await repo.profiles.updateSettings(id, { ...settingsRepairs(settings), ...patch });
      } catch (error: unknown) {
        console.error('[settings] could not save settings', error);
        notify(t(isValidation(error) ? 'set_settings_error_validation' : 'set_action_failed'), 'error');
      }
    },
    [repo, id, settings, t],
  );
}
