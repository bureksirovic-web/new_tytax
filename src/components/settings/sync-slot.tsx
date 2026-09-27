'use client';
import dynamic from 'next/dynamic';
import { useT } from '@/lib/i18n/use-t';
import { SettingsCard } from './settings-section';

/** G5's sync UI, loaded only when sync is enabled (no Supabase code otherwise). */
const SyncStatus = dynamic(() => import('@/components/sync/sync-status').then((m) => m.SyncStatus), { ssr: false });

export function isSyncEnabled(flag: string | undefined = process.env.NEXT_PUBLIC_SYNC_ENABLED): boolean {
  return flag === '1' || flag === 'true';
}

/**
 * Mount point for G5's sync & account panel (`data-testid="settings-sync-slot"`).
 * With sync off it only says so: no sign-in button, no network calls.
 */
export function SyncSlot({ enabled = isSyncEnabled() }: { enabled?: boolean }) {
  const { t } = useT();
  return (
    <SettingsCard title={t('set_section_sync')} testId="settings-sync-slot">
      {enabled ? <SyncStatus /> : <p className="text-sm text-fg-2">{t('set_sync_disabled')}</p>}
    </SettingsCard>
  );
}
