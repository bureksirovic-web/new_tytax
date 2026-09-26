'use client';
import { useId, useState } from 'react';
import { useRepo } from '@/hooks/use-repo';
import { Badge, Button, Modal } from '@/components/ui';
import { useT } from '@/lib/i18n/use-t';
import type { BackupCounts } from './backup-io';
import { backupErrorKey, type BackupService, type InspectedProfile } from './backup-service';
import { notify } from './settings-utils';

export interface PendingRestore {
  text: string;
  counts: BackupCounts;
  profiles: InspectedProfile[];
}

/**
 * Preview of a validated backup: its profiles (flagging the ones already on
 * this device) and row counts. When a restore would merge into an existing
 * profile, the user must tick an explicit acknowledgement first.
 */
export function RestoreDialog({ pending, service, onClose }: { pending: PendingRestore; service: BackupService; onClose: () => void }) {
  const { t } = useT();
  const repo = useRepo();
  const ackId = useId();
  const [busy, setBusy] = useState(false);
  const [ack, setAck] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const { counts, profiles } = pending;
  const existing = profiles.filter((p) => p.existsLocally);
  const needsAck = existing.length > 0;

  async function restore() {
    setBusy(true);
    setFailed(null);
    try {
      const result = await service.restore(repo, pending.text, { confirmOverwrite: needsAck && ack });
      notify(t('set_restore_done', { inserted: result.inserted, updated: result.updated }));
      onClose();
    } catch (error: unknown) {
      console.error('[settings] restore failed', error);
      setFailed(t('set_restore_failed', { reason: t(backupErrorKey(error)) }));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={t('set_restore')} size="sm">
      <div className="space-y-3" data-testid="settings-restore-preview">
        <p className="text-sm text-fg">{t('set_restore_profiles_title', { n: profiles.length })}</p>
        <ul className="space-y-1" data-testid="settings-restore-profiles">
          {profiles.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-2 text-sm text-fg" data-testid={`settings-restore-profile-${p.id}`}>
              <span className="truncate">{p.name}</span>
              <Badge variant={p.existsLocally ? 'warning' : 'default'}>
                {t(p.existsLocally ? 'set_restore_profile_existing' : 'set_restore_profile_new')}
              </Badge>
            </li>
          ))}
        </ul>
        <p className="text-sm text-fg-2">
          {t('set_restore_preview', { logs: counts.logs, programs: counts.programs, bw: counts.bodyweight })}
        </p>
        {needsAck ? (
          <div className="space-y-2 rounded-lg border border-tactical-amber-400 p-3" data-testid="settings-restore-existing">
            <p className="text-sm text-fg">
              {t('set_restore_existing_warning', { names: existing.map((p) => p.name).join(', ') })}
            </p>
            <label htmlFor={ackId} className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-fg">
              <input
                id={ackId}
                type="checkbox"
                checked={ack}
                onChange={(e) => setAck(e.target.checked)}
                data-testid="settings-restore-ack"
                className="h-5 w-5 accent-tactical-amber-400"
              />
              {t('set_restore_existing_ack')}
            </label>
          </div>
        ) : (
          <p className="text-xs text-fg-muted">{t('set_restore_merge_note')}</p>
        )}
        <div aria-live="polite">
          {failed && (
            <p role="alert" className="text-sm text-red-300" data-testid="settings-restore-failed">
              {failed}
            </p>
          )}
        </div>
        <div className="flex justify-end gap-3">
          <Button variant="ghost" size="sm" onClick={onClose}>
            {t('cancel')}
          </Button>
          <Button
            size="sm"
            loading={busy}
            disabled={busy || (needsAck && !ack)}
            onClick={() => void restore()}
            data-testid="settings-restore-confirm"
          >
            {t(needsAck ? 'set_restore_confirm_merge' : 'set_restore_confirm')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
