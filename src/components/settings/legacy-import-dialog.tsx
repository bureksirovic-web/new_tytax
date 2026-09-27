'use client';
import { useMemo, useState } from 'react';
import type { Profile } from '@/contracts/domain';
import { useRepo } from '@/hooks/use-repo';
import { Button, Modal } from '@/components/ui';
import { useT } from '@/lib/i18n/use-t';
import { legacyErrorKey, type LegacyImportApi, type LegacyImportPreview, type LegacyImportResult } from './legacy-import-api';
import { checkMapping, defaultChoices, type Choices } from './legacy-import-model';
import { LegacyImportResultView } from './legacy-import-result';
import { LegacyUserRow, WarningList } from './legacy-user-row';
import '@/lib/i18n/packs/settings';

interface LegacyImportDialogProps {
  api: LegacyImportApi;
  /** The file's JSON text, handed to G2 again on confirm (G2 re-parses; nothing is kept between calls). */
  text: string;
  preview: LegacyImportPreview;
  profiles: readonly Profile[];
  onClose: () => void;
}

const PROBLEM_KEY = {
  nothing: 'set_legacy_problem_nothing',
  same_profile: 'set_legacy_problem_same_profile',
} as const;

/** Preview of a legacy file with a target per user; confirm runs G2's import in one transaction. */
export function LegacyImportDialog({ api, text, preview, profiles, onClose }: LegacyImportDialogProps) {
  const { t } = useT();
  const repo = useRepo();
  const [choices, setChoices] = useState<Choices>(() => defaultChoices(preview.users));
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [result, setResult] = useState<LegacyImportResult | null>(null);
  const check = useMemo(() => checkMapping(preview.users, choices, profiles), [preview.users, choices, profiles]);

  async function confirm() {
    if (!check.options) return;
    setBusy(true);
    setFailed(null);
    try {
      setResult(await api.run(repo, text, check.options));
    } catch (error: unknown) {
      console.error('[settings] legacy import failed', error);
      setFailed(t('set_legacy_failed', { reason: t(legacyErrorKey(error)) }));
    } finally {
      setBusy(false);
    }
  }

  const close = () => {
    if (!busy) onClose();
  };

  return (
    <Modal open onClose={close} title={t('set_legacy_preview_title')} size="lg">
      {result ? (
        <div className="space-y-4">
          <LegacyImportResultView result={result} choices={choices} profiles={profiles} />
          <div className="flex justify-end">
            <Button size="sm" onClick={onClose} data-testid="settings-legacy-close">
              {t('close')}
            </Button>
          </div>
        </div>
      ) : (
        <div className="max-h-[70vh] space-y-3 overflow-y-auto" data-testid="settings-legacy-preview" aria-busy={busy}>
          <p className="text-sm text-fg-2">
            {t(preview.format === 'app-backup' ? 'set_legacy_format_app_backup' : 'set_legacy_format_dump')}
          </p>
          <WarningList
            label={t('set_legacy_file_warnings', { n: preview.warnings.length })}
            warnings={preview.warnings}
            testId="legacy-file-warnings"
          />
          <ul className="space-y-3">
            {preview.users.map((user) => (
              <LegacyUserRow
                key={user.username}
                user={user}
                choice={choices[user.username]}
                profiles={profiles}
                nameProblem={check.names[user.username]}
                disabled={busy}
                onChange={(c) => setChoices((prev) => ({ ...prev, [user.username]: c }))}
              />
            ))}
          </ul>
          {check.problem && <p className="text-sm text-fg-muted">{t(PROBLEM_KEY[check.problem])}</p>}
          {failed && (
            <p role="alert" className="text-sm text-red-300" data-testid="settings-legacy-failed">
              {failed}
            </p>
          )}
          <div className="flex justify-end gap-3">
            <Button variant="ghost" size="sm" disabled={busy} onClick={onClose} data-testid="settings-legacy-cancel">
              {t('cancel')}
            </Button>
            <Button
              size="sm"
              loading={busy}
              disabled={busy || check.options === null}
              onClick={() => void confirm()}
              data-testid="settings-legacy-confirm"
            >
              {t('set_legacy_confirm')}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
