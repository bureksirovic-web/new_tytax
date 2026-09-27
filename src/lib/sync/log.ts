/**
 * Sync logging: event name, table, reason/status code and counts only.
 * Never payloads, record contents, ids or tokens.
 */

export interface SyncLogEvent {
  event: 'skip' | 'fail' | 'defer' | 'retry' | 'run' | 'undelete';
  table?: string;
  /** Reason or status code, e.g. `missing_local`, `23503`, `network`. */
  code?: string;
  count?: number;
}

export type SyncLogger = (e: SyncLogEvent) => void;

export const consoleSyncLogger: SyncLogger = (e) => {
  console.warn('[sync]', e.event, e.table ?? '-', e.code ?? '-', e.count ?? '-');
};

export const silentSyncLogger: SyncLogger = () => {};
