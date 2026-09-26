'use client';
import { useState } from 'react';
import { useRepo } from '@/hooks/use-repo';
import { Button, Modal } from '@/components/ui';
import { useT } from '@/lib/i18n/use-t';
import type { ParsedBackup } from './backup-io';
import { notify } from './settings-utils';

type Valid = Extract<ParsedBackup, { ok: true }>;

/** Preview of a validated backup; commits it in one repository transaction (idempotent by record id). */
export function RestoreDialog({ parsed, onClose }: { parsed: Valid; onClose: () => void }) {
  const { t } = useT();
  const repo = useRepo();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const { counts, profileNames } = parsed;

  async function restore() {
    setBusy(true);
    setFailed(null);
    try {
      const result = await repo.importBackup(parsed.backup);
      notify(t('set_restore_done', { inserted: result.inserted, updated: result.updated }));
      onClose();
    } catch (error: unknown) {
      console.error('[settings] restore failed', error);
      setFailed(t('set_restore_failed', { reason: error instanceof Error ? error.message : String(error) }));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={t('set_restore')} size="sm">
      <div className="space-y-3" data-testid="settings-restore-preview">
        <p className="text-sm text-fg">{t('set_restore_profiles', { names: profileNames.join(', '), n: counts.profiles })}</p>
        <p className="text-sm text-fg-2">
          {t('set_restore_preview', { logs: counts.logs, programs: counts.programs, bw: counts.bodyweight })}
        </p>
        <p className="text-xs text-fg-muted">{t('set_restore_merge_note')}</p>
        {failed && (
          <p role="alert" className="text-sm text-red-300">
            {failed}
          </p>
        )}
        <div className="flex justify-end gap-3">
          <Button variant="ghost" size="sm" onClick={onClose}>
            {t('cancel')}
          </Button>
          <Button size="sm" loading={busy} disabled={busy} onClick={() => void restore()} data-testid="settings-restore-confirm">
            {t('set_restore_confirm')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
