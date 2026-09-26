'use client';
import { useEffect, useState } from 'react';
import type { Profile } from '@/contracts/domain';
import { useRepo } from '@/hooks/use-repo';
import { Button } from '@/components/ui';
import { useT } from '@/lib/i18n/use-t';
import { csvFilename, loadCsvApi, loadLegacyImportApi, type CsvApi } from './export-adapter';
import { FieldLabel, Hint } from './settings-section';
import { downloadText, localDay, notify } from './settings-utils';

type Kind = 'workouts' | 'bodyweight';

/** CSV export (current profile only, always kg) and the legacy-app import (pending G2's API). */
export function ExportPanel({ profile }: { profile: Profile }) {
  const { t } = useT();
  const repo = useRepo();
  const [api, setApi] = useState<CsvApi | null>(null);
  const [legacyReady, setLegacyReady] = useState(false);
  const [busy, setBusy] = useState<Kind | null>(null);

  useEffect(() => {
    let live = true;
    void loadCsvApi().then((a) => live && setApi(a));
    void loadLegacyImportApi().then((l) => live && setLegacyReady(l !== null));
    return () => {
      live = false;
    };
  }, []);

  async function exportCsv(kind: Kind) {
    setBusy(kind);
    try {
      let csv: string | undefined;
      if (kind === 'workouts' && api?.workouts) {
        const logs = await repo.logs.list(profile.id);
        csv = logs.length ? api.workouts(logs) : undefined;
      } else if (kind === 'bodyweight' && api?.bodyweight) {
        const entries = await repo.bodyweight.list(profile.id);
        csv = entries.length ? api.bodyweight(entries) : undefined;
      }
      if (csv === undefined) notify(t('set_export_empty'), 'info');
      else downloadText(csv, csvFilename(kind, localDay()), 'text/csv;charset=utf-8');
    } catch (error: unknown) {
      console.error('[settings] CSV export failed', error);
      notify(t('set_action_failed'), 'error');
    } finally {
      setBusy(null);
    }
  }

  const bwMissing = api !== null && !api.bodyweight;
  const workoutsMissing = api !== null && !api.workouts;

  return (
    <div className="space-y-3">
      <FieldLabel>{t('set_export_csv')}</FieldLabel>
      <Hint>{t('set_export_csv_hint')}</Hint>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          size="md"
          loading={busy === 'workouts'}
          disabled={!api || workoutsMissing || busy !== null}
          aria-describedby={workoutsMissing ? 'settings-csv-unavailable' : undefined}
          onClick={() => void exportCsv('workouts')}
          data-testid="settings-csv-workouts"
        >
          {t('set_export_csv_workouts')}
        </Button>
        <Button
          variant="secondary"
          size="md"
          loading={busy === 'bodyweight'}
          disabled={!api || bwMissing || busy !== null}
          aria-describedby={bwMissing ? 'settings-csv-unavailable' : undefined}
          onClick={() => void exportCsv('bodyweight')}
          data-testid="settings-csv-bodyweight"
        >
          {t('set_export_csv_bodyweight')}
        </Button>
      </div>
      {(bwMissing || workoutsMissing) && <Hint id="settings-csv-unavailable">{t('set_feature_pending')}</Hint>}

      <FieldLabel>{t('set_legacy_import')}</FieldLabel>
      <Hint>{t('set_legacy_import_hint')}</Hint>
      <Button
        variant="secondary"
        size="md"
        disabled={!legacyReady}
        aria-describedby={legacyReady ? undefined : 'settings-legacy-unavailable'}
        data-testid="settings-legacy-import"
      >
        {t('set_legacy_import_btn')}
      </Button>
      {!legacyReady && <Hint id="settings-legacy-unavailable">{t('set_feature_pending')}</Hint>}
    </div>
  );
}
