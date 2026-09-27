'use client';
import { useEffect, useRef, useState } from 'react';
import type { Profile } from '@/contracts/domain';
import { useRepo } from '@/hooks/use-repo';
import { Button } from '@/components/ui';
import { useT } from '@/lib/i18n/use-t';
import { loadLegacyImportApi } from './export-adapter';
import { LEGACY_MAX_BYTES, legacyErrorKey, type LegacyImportApi, type LegacyImportPreview } from './legacy-import-api';
import { LegacyImportDialog } from './legacy-import-dialog';
import { FieldLabel, Hint } from './settings-section';
import '@/lib/i18n/packs/settings';

interface Opened {
  text: string;
  preview: LegacyImportPreview;
  profiles: Profile[];
}

/**
 * "Import from the old TYTAX app": pick a JSON file, preview it with G2's
 * service, choose a target per legacy user, import. Disabled with the
 * "not available yet" note while the adapter returns no API.
 * `loadApi` exists for tests; the app always uses the adapter.
 */
export function LegacyImport({ loadApi = loadLegacyImportApi }: { loadApi?: () => Promise<LegacyImportApi | null> }) {
  const { t } = useT();
  const repo = useRepo();
  const fileRef = useRef<HTMLInputElement>(null);
  const [api, setApi] = useState<LegacyImportApi | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [opened, setOpened] = useState<Opened | null>(null);

  useEffect(() => {
    let live = true;
    void loadApi().then(
      (a) => live && setApi(a),
      (error: unknown) => console.error('[settings] legacy import module failed to load', error),
    );
    return () => {
      live = false;
    };
  }, [loadApi]);

  async function onFile(file: File | undefined) {
    if (fileRef.current) fileRef.current.value = '';
    if (!file || !api) return;
    setProblem(null);
    setBusy(true);
    try {
      if (file.size > LEGACY_MAX_BYTES) throw Object.assign(new Error('file too large'), { code: 'TOO_LARGE' });
      const text = await file.text();
      const [preview, profiles] = await Promise.all([api.preview(text), repo.profiles.list()]);
      setOpened({ text, preview, profiles });
    } catch (error: unknown) {
      console.error('[settings] legacy preview failed', error);
      setProblem(t('set_legacy_failed', { reason: t(legacyErrorKey(error)) }));
    } finally {
      setBusy(false);
    }
  }

  const ready = api !== null;
  return (
    <div className="space-y-3">
      <FieldLabel>{t('set_legacy_import')}</FieldLabel>
      <Hint>{t('set_legacy_import_hint')}</Hint>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="sr-only"
        tabIndex={-1}
        aria-label={t('set_legacy_import_choose')}
        disabled={!ready || busy}
        data-testid="settings-legacy-input"
        onChange={(e) => void onFile(e.target.files?.[0])}
      />
      <Button
        variant="secondary"
        size="md"
        loading={busy}
        disabled={!ready || busy}
        aria-describedby={ready ? undefined : 'settings-legacy-unavailable'}
        onClick={() => fileRef.current?.click()}
        data-testid="settings-legacy-import"
      >
        {t('set_legacy_import_btn')}
      </Button>
      {!ready && <Hint id="settings-legacy-unavailable">{t('set_feature_pending')}</Hint>}
      {problem && (
        <p role="alert" className="text-sm text-red-300" data-testid="settings-legacy-error">
          {problem}
        </p>
      )}
      {opened && api && (
        <LegacyImportDialog
          api={api}
          text={opened.text}
          preview={opened.preview}
          profiles={opened.profiles}
          onClose={() => setOpened(null)}
        />
      )}
    </div>
  );
}
