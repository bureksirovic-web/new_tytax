'use client';
import { useSync } from '@/hooks/use-sync';

export function SyncStatus() {
  const { isSyncing, pendingCount, lastSync, sync } = useSync();

  return (
    <div className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 px-4 py-3">
      <div className="flex flex-col gap-0.5 text-sm">
        <span className="text-white/60">
          {pendingCount > 0
            ? `${pendingCount} change${pendingCount === 1 ? '' : 's'} pending`
            : 'All changes synced'}
        </span>
        {lastSync && (
          <span className="text-xs text-white/40">
            Last sync: {new Date(lastSync).toLocaleString()}
          </span>
        )}
      </div>
      <button
        onClick={sync}
        disabled={isSyncing}
        className="ml-auto rounded-md bg-white/10 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isSyncing ? 'Syncing...' : 'Sync Now'}
      </button>
    </div>
  );
}
