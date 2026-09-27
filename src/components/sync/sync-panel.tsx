'use client';
import { Button } from '@/components/ui';
import { useSync } from '@/hooks/use-sync';
import { useAuthT } from '@/lib/auth/use-auth-t';
import { SyncAccount } from './sync-account';
import { SyncDetails } from './sync-details';

export interface SyncPanelProps {
  /** Where sign-in returns to (default the settings page). */
  nextPath?: string;
}

/**
 * Sync status, account and the manual "Sync now" button. With sync off it
 * shows one line saying so, and nothing in it touches the network.
 */
export function SyncPanel({ nextPath = '/settings' }: SyncPanelProps) {
  const t = useAuthT();
  const { enabled, state, account, syncNow, signOut } = useSync();
  const canSync = enabled && account.status === 'signed_in' && state.status !== 'syncing';

  return (
    <section
      data-testid="sync-panel"
      aria-labelledby="sync-panel-title"
      className="space-y-4 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] p-4"
    >
      <h2 id="sync-panel-title" className="font-['Oswald'] text-sm font-semibold uppercase tracking-wider text-[var(--text-primary)]">
        {t('sync.panel.title')}
      </h2>
      <SyncDetails state={state} />
      <SyncAccount account={account} nextPath={nextPath} onSignOut={signOut} />
      {enabled && (
        <Button
          data-testid="sync-now"
          fullWidth
          loading={state.status === 'syncing'}
          disabled={!canSync}
          onClick={() => void syncNow()}
        >
          {t('sync.now')}
        </Button>
      )}
    </section>
  );
}
