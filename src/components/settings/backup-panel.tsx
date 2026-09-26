'use client';
import { useId, useRef, useState } from 'react';
import type { Profile } from '@/contracts/domain';
import { useRepo } from '@/hooks/use-repo';
import { Button } from '@/components/ui';
import { useT } from '@/lib/i18n/use-t';
import { BACKUP_PROBLEM_KEY, backupFilename, MAX_BACKUP_BYTES, parseBackupText, type ParsedBackup } from './backup-io';
import { RestoreDialog } from './restore-dialog';
import { FieldLabel, Hint, SelectField } from './settings-section';
import { downloadText, localDay, notify } from './settings-utils';

type Scope = 'profile' | 'all';

/** JSON backup download (this profile / all profiles) and validated restore with a preview. */
export function BackupPanel({ profile }: { profile: Profile }) {
  const { t } = useT();
  const repo = useRepo();
  const fileId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [scope, setScope] = useState<Scope>('profile');
  const [busy, setBusy] = useState(false);
  const [parsed, setParsed] = useState<Extract<ParsedBackup, { ok: true }> | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  async function backup() {
    setBusy(true);
    try {
      const data = await repo.exportBackup(scope === 'profile' ? profile.id : undefined);
      downloadText(JSON.stringify(data, null, 2), backupFilename(scope, profile.name, localDay()), 'application/json');
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
    if (!file) return;
    const result = file.size > MAX_BACKUP_BYTES ? ({ ok: false, problem: 'too_large' } as const) : parseBackupText(await file.text());
    if (result.ok) setParsed(result);
    else setProblem(t(BACKUP_PROBLEM_KEY[result.problem]));
    if (fileRef.current) fileRef.current.value = '';
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
      <Button variant="secondary" size="md" loading={busy} disabled={busy} onClick={() => void backup()} data-testid="settings-backup-download">
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
          data-testid="settings-restore-input"
          onChange={(e) => void onFile(e.target.files?.[0])}
          className="block min-h-11 w-full text-sm text-fg-2 file:mr-3 file:min-h-11 file:rounded-lg file:border file:border-line file:bg-card file:px-3 file:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tactical-amber-400"
        />
        {problem && (
          <p role="alert" className="text-sm text-red-300" data-testid="settings-restore-error">
            {t('set_restore_failed', { reason: problem })}
          </p>
        )}
      </div>
      {parsed && <RestoreDialog parsed={parsed} onClose={() => setParsed(null)} />}
    </div>
  );
}
