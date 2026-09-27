'use client';
import { useState } from 'react';
import { useRepo } from '@/hooks/use-repo';
import { useWorkoutStore } from '@/stores/workout-store';
import { Button } from '@/components/ui';
import { useT } from '@/lib/i18n/use-t';
import { Hint, SettingsCard } from './settings-section';
import { notify } from './settings-utils';
import { TypeToConfirmDialog } from './type-to-confirm-dialog';
import '@/lib/i18n/packs/settings';

/** Only the app's own keys are cleared, never all of origin storage. */
export const APP_STORAGE_PREFIXES = ['tytax', 'locale', 'theme', 'units'] as const;

export function clearAppStorage(storage: Storage): void {
  const keys: string[] = [];
  for (let i = 0; i < storage.length; i += 1) {
    const key = storage.key(i);
    if (key && APP_STORAGE_PREFIXES.some((p) => key.startsWith(p))) keys.push(key);
  }
  keys.forEach((k) => storage.removeItem(k));
}

/** Device wipe (every profile), behind a typed confirmation word. */
export function DangerZone({ onWiped }: { onWiped?: () => void }) {
  const { t } = useT();
  const repo = useRepo();
  const [open, setOpen] = useState(false);
  const word = t('set_wipe_word');

  async function wipe() {
    setOpen(false);
    try {
      await repo.resetAll();
      // Drop the in-memory workout draft too, or it would be written back after the wipe.
      useWorkoutStore.getState().discard();
      try {
        clearAppStorage(window.localStorage);
      } catch {
        // Storage unavailable (private mode): nothing to clear.
      }
      if (onWiped) onWiped();
      else window.location.reload();
    } catch (error: unknown) {
      console.error('[settings] device wipe failed', error);
      notify(t('set_action_failed'), 'error');
    }
  }

  return (
    <SettingsCard title={t('set_section_danger')} testId="settings-danger">
      <Hint>{t('set_wipe_device_message')}</Hint>
      <Button variant="danger" size="md" onClick={() => setOpen(true)} data-testid="settings-wipe-device">
        {t('set_wipe_device')}
      </Button>
      {open && (
        <TypeToConfirmDialog
          open
          title={t('set_wipe_device')}
          message={t('set_wipe_device_message')}
          word={word}
          inputLabel={t('set_wipe_type_to_confirm', { word })}
          confirmLabel={t('delete')}
          testIdPrefix="settings-wipe"
          onConfirm={() => void wipe()}
          onCancel={() => setOpen(false)}
        />
      )}
    </SettingsCard>
  );
}
