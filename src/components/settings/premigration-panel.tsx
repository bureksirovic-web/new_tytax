'use client';
import { useEffect, useState } from 'react';
import { Button, ConfirmDialog } from '@/components/ui';
import { useT } from '@/lib/i18n/use-t';
import { loadPreMigrationApi, preMigrationFilename, type PreMigrationApi } from './premigration-adapter';
import { FieldLabel, Hint } from './settings-section';
import { downloadText, notify } from './settings-utils';
import '@/lib/i18n/packs/settings';

type Loaded = { api: PreMigrationApi; data: { exportedAt: string } };

/**
 * Offers the copy of the data taken automatically before the v2 → v3 database
 * update. Rendered only when such a copy exists. `loadApi` exists for tests.
 */
export function PreMigrationPanel({ loadApi = loadPreMigrationApi }: { loadApi?: () => Promise<PreMigrationApi | null> }) {
  const { t } = useT();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    let live = true;
    void (async () => {
      const api = await loadApi();
      const data = api ? await api.get() : null;
      if (live && api && data) setLoaded({ api, data });
    })().catch((error: unknown) => console.error('[settings] pre-migration export failed to load', error));
    return () => {
      live = false;
    };
  }, [loadApi]);

  if (!loaded) return null;

  async function clear() {
    setConfirming(false);
    if (!loaded) return;
    try {
      await loaded.api.clear();
      setLoaded(null);
      notify(t('set_premigration_cleared'));
    } catch (error: unknown) {
      console.error('[settings] clearing the pre-migration export failed', error);
      notify(t('set_action_failed'), 'error');
    }
  }

  return (
    <div className="space-y-3" data-testid="settings-premigration">
      <FieldLabel>{t('set_premigration_title')}</FieldLabel>
      <Hint>{t('set_premigration_hint')}</Hint>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          size="md"
          data-testid="settings-premigration-download"
          onClick={() => downloadText(JSON.stringify(loaded.data, null, 2), preMigrationFilename(loaded.data.exportedAt), 'application/json')}
        >
          {t('set_premigration_download')}
        </Button>
        <Button variant="ghost" size="md" data-testid="settings-premigration-clear" onClick={() => setConfirming(true)}>
          {t('set_premigration_clear')}
        </Button>
      </div>
      <ConfirmDialog
        open={confirming}
        title={t('set_premigration_clear')}
        message={t('set_premigration_clear_message')}
        confirmLabel={t('delete')}
        cancelLabel={t('cancel')}
        danger
        onConfirm={() => void clear()}
        onCancel={() => setConfirming(false)}
      />
    </div>
  );
}
