'use client';
import { useEffect, useId, useRef, useState } from 'react';
import type { Profile } from '@/contracts/domain';
import { useRepo } from '@/hooks/use-repo';
import { Button } from '@/components/ui';
import { useT } from '@/lib/i18n/use-t';
import { BACKUP_PROBLEM_KEY, backupFilename, MAX_BACKUP_BYTES, parseBackupText } from './backup-io';
import { backupErrorKey, loadBackupService, type BackupService } from './backup-service';
import { RestoreDialog, type PendingRestore } from './restore-dialog';
import { FieldLabel, Hint, SelectField } from './settings-section';
import { downloadText, localDay, notify } from './settings-utils';
import '@/lib/i18n/packs/settings';

type Scope = 'profile' | 'all';

/**
 * JSON backup download (this profile / all profiles) and restore: the file is
 * validated locally, inspected (which profiles already exist here) and only
 * written after the preview is confirmed. `loadService` exists for tests.
 */
export function BackupPanel({ profile, loadService = loadBackupService }: { profile: Profile; loadService?: () => Promise<BackupService> }) {
  const { t } = useT();
  const repo = useRepo();
  const fileId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [service, setService] = useState<BackupService | null>(null);
  const [scope, setScope] = useState<Scope>('profile');
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<PendingRestore | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    void loadService().then(
      (s) => live && setService(s),
      (error: unknown) => console.error('[settings] backup service failed to load', error),
    );
    return () => {
      live = false;
    };
  }, [loadService]);

  async function backup() {
    if (!service) return;
    setBusy(true);
    try {
      const json = await service.exportJson(repo, scope === 'profile' ? profile.id : undefined);
      downloadText(json, backupFilename(scope, profile.name, localDay()), 'application/json');
      notify(t('set_backup_done'));
    } catch (error: unknown) {
      console.error('[settings] backup failed', error);
      notify(t('set_action_failed'), 'error');
    } finally {
      setBusy(false);
    }
  }

  async function onFile(file: File | undefined) {
    setProblem(null);
    if (fileRef.current) fileRef.current.value = '';
    if (!file || !service) return;
    setBusy(true);
    try {
      const text = file.size > MAX_BACKUP_BYTES ? '' : await file.text();
      const parsed = file.size > MAX_BACKUP_BYTES ? ({ ok: false, problem: 'too_large' } as const) : parseBackupText(text);
      if (!parsed.ok) {
        setProblem(t(BACKUP_PROBLEM_KEY[parsed.problem]));
        return;
      }
      const { profiles } = await service.inspect(repo, text);
      setPending({ text, counts: parsed.counts, profiles });
    } catch (error: unknown) {
      console.error('[settings] backup inspection failed', error);
      setProblem(t(backupErrorKey(error)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <FieldLabel>{t('set_backup')}</FieldLabel>
      <Hint>{t('set_backup_hint')}</Hint>
      <SelectField<Scope>
        label={t('set_backup_scope')}
        value={scope}
        testId="settings-backup-scope"
        options={[
          { value: 'profile', label: t('set_backup_scope_profile') },
          { value: 'all', label: t('set_backup_scope_all') },
        ]}
        onChange={setScope}
      />
      <Button
        variant="secondary"
        size="md"
        loading={busy}
        disabled={busy || !service}
        onClick={() => void backup()}
        data-testid="settings-backup-download"
      >
        {t('set_backup_download')}
      </Button>
      <div className="space-y-1">
        <label htmlFor={fileId} className="block text-xs font-medium uppercase tracking-wider text-fg-muted">
          {t('set_restore')}
        </label>
        <input
          id={fileId}
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          disabled={busy || !service}
          data-testid="settings-restore-input"
          onChange={(e) => void onFile(e.target.files?.[0])}
          className="block min-h-11 w-full text-sm text-fg-2 file:mr-3 file:min-h-11 file:rounded-lg file:border file:border-line file:bg-card file:px-3 file:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tactical-amber-400"
        />
        <div aria-live="polite">
          {problem && (
            <p role="alert" className="text-sm text-red-300" data-testid="settings-restore-error">
              {t('set_restore_failed', { reason: problem })}
            </p>
          )}
        </div>
      </div>
      {pending && service && <RestoreDialog pending={pending} service={service} onClose={() => setPending(null)} />}
    </div>
  );
}
