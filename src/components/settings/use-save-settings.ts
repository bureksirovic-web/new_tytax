'use client';
import { useCallback } from 'react';
import type { Profile, ProfileSettings } from '@/contracts/domain';
import { useRepo } from '@/hooks/use-repo';
import { useT } from '@/lib/i18n/use-t';
import { notify } from './settings-utils';

/** Persists a settings patch for `profile` immediately; toasts only on error. */
export function useSaveSettings(profile: Profile): (patch: Partial<ProfileSettings>) => Promise<void> {
  const repo = useRepo();
  const { t } = useT();
  const id = profile.id;
  return useCallback(
    async (patch: Partial<ProfileSettings>) => {
      try {
        await repo.profiles.updateSettings(id, patch);
      } catch (error: unknown) {
        console.error('[settings] could not save settings', error);
        notify(t('set_action_failed'), 'error');
      }
    },
    [repo, id, t],
  );
}
