// Re-export of the frozen contract (src/contracts/sync.ts). Do not add types here.
export type {
  SyncTable,
  SyncOperationType,
  SyncOperation,
  SyncCursor,
  SyncStatus,
  SyncState,
  SyncResult,
  SyncOutbox,
  SyncAdapter,
  ApplyRemoteResult,
} from '@/contracts/sync';
export { SYNC_TABLES, noopSyncAdapter } from '@/contracts/sync';
