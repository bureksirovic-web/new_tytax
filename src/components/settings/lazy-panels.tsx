'use client';
import dynamic from 'next/dynamic';
import { useT } from '@/lib/i18n/use-t';
import { SettingsCard } from './settings-section';

/**
 * The heavy settings panels, split out of the /settings first-load JS (F4:
 * budget 250 kB gzip): backup/restore, CSV export, legacy import and the
 * equipment inventory load after the page shell. The section shells keep
 * their headings and test ids while loading.
 */
function Loading() {
  const { t } = useT();
  return (
    <p role="status" className="min-h-11 text-sm text-fg-muted">
      {t('loading')}
    </p>
  );
}

function EquipmentLoading() {
  const { t } = useT();
  return (
    <SettingsCard title={t('set_section_equipment')} testId="settings-equipment">
      <Loading />
    </SettingsCard>
  );
}

export const LazyDataPanels = dynamic(() => import('./data-panels').then((m) => m.DataPanels), { loading: Loading });

export const LazyEquipmentCard = dynamic(() => import('./equipment-card').then((m) => m.EquipmentCard), {
  loading: EquipmentLoading,
});
