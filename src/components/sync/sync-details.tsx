'use client';
import type { SyncState } from '@/contracts/sync';
import { useLocale } from '@/components/providers/locale-provider';
import type { AuthKey } from '@/lib/auth/i18n';
import { useAuthT } from '@/lib/auth/use-auth-t';
import { formatSyncedAt, syncErrorKey } from './format';

const STATUS_KEY: Record<SyncState['status'], AuthKey> = {
  disabled: 'sync.status.disabled',
  idle: 'sync.status.idle',
  syncing: 'sync.status.syncing',
  error: 'sync.status.error',
  offline: 'sync.status.offline',
};

const ROW = 'flex items-baseline justify-between gap-3 text-sm';
const LABEL = 'text-[var(--text-muted)]';
const VALUE = 'font-mono text-[var(--text-primary)] text-right';

/** Status, last sync, pending count and last error of the sync adapter. */
export function SyncDetails({ state }: { state: SyncState }) {
  const t = useAuthT();
  const { locale } = useLocale();
  const lastSynced = formatSyncedAt(state.lastSyncedAt, locale);

  if (state.status === 'disabled') {
    return (
      <p data-testid="sync-status" data-status="disabled" className="text-sm text-[var(--text-muted)]">
        {t('sync.status.disabled')}
      </p>
    );
  }

  return (
    <dl className="space-y-2">
      <div className={ROW}>
        <dt className={LABEL}>{t('sync.status.label')}</dt>
        {/* role="status" on an inner span: on the <dd> it replaced the definition
            role and axe flagged the <dl> (definition-list, serious). */}
        <dd data-testid="sync-status" data-status={state.status} className={VALUE}>
          <span role="status" aria-live="polite">
            {t(STATUS_KEY[state.status])}
          </span>
        </dd>
      </div>
      <div className={ROW}>
        <dt className={LABEL}>{t('sync.last_synced')}</dt>
        <dd data-testid="sync-last-synced" data-value={state.lastSyncedAt ?? ''} className={VALUE}>
          {lastSynced ?? t('sync.never')}
        </dd>
      </div>
      <div className={ROW}>
        <dt className={LABEL}>{t('sync.pending')}</dt>
        <dd data-testid="sync-pending" className={VALUE}>
          {state.pending}
        </dd>
      </div>
      {state.lastError && (
        <div className={ROW}>
          <dt className={LABEL}>{t('sync.error.label')}</dt>
          <dd data-testid="sync-error" className="text-right text-red-300">
            {t(syncErrorKey(state.lastError))} <code className="font-mono text-xs text-[var(--text-muted)]">{state.lastError}</code>
          </dd>
        </div>
      )}
    </dl>
  );
}
