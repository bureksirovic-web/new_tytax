'use client';
import { useState } from 'react';
import { useRepo } from '@/hooks/use-repo';
import { Button, ConfirmDialog } from '@/components/ui';
import { useLocale } from '@/components/providers';
import { downloadCSV, workoutLogsToCSV } from '@/lib/export/csv';
import { Section, SectionTitle } from './settings-section';

/** CSV export of the active profile's logs, and the full local reset. */
export function DataSection({ profileId }: { profileId: string | undefined }) {
  const { t } = useLocale();
  const repo = useRepo();
  const [resetOpen, setResetOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  async function handleExportCSV() {
    if (!profileId) return;
    setExporting(true);
    try {
      const logs = await repo.logs.list(profileId);
      const csv = workoutLogsToCSV(logs);
      const date = new Date().toISOString().slice(0, 10);
      downloadCSV(csv, `new_tytax_export_${date}.csv`);
    } finally {
      setExporting(false);
    }
  }

  async function handleResetAllData() {
    setResetOpen(false);
    try {
      await repo.resetAll();
    } finally {
      try {
        localStorage.clear();
      } catch {
        // Storage unavailable (private mode): nothing to clear.
      }
      window.location.reload();
    }
  }

  return (
    <Section testId="settings-data">
      <SectionTitle>{t('data')}</SectionTitle>
      <div className="flex flex-col gap-2">
        <Button variant="secondary" size="sm" loading={exporting} disabled={!profileId} onClick={() => void handleExportCSV()}>
          {t('export_csv')}
        </Button>
        <Button variant="danger" size="sm" onClick={() => setResetOpen(true)}>
          {t('reset_all_data')}
        </Button>
      </div>
      <ConfirmDialog
        open={resetOpen}
        onCancel={() => setResetOpen(false)}
        onConfirm={() => void handleResetAllData()}
        title={t('reset_all_data')}
        message={t('reset_all_data_message')}
        confirmLabel={t('reset')}
        cancelLabel={t('cancel')}
        danger
      />
    </Section>
  );
}
