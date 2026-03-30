export type SyncOperationType = 'create' | 'update' | 'delete';

export interface SyncOperation {
  id: string;
  tableName: string;
  operationType: SyncOperationType;
  recordId: string;
  payload: Record<string, unknown>;
  createdAt: string;
  retryCount: number;
  lastError?: string;
}

export interface SyncMetadata {
  id: string;
  profileId: string;
  tableName: string;
  deviceId: string;
  lastSyncedAt: string;
}

export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error' | 'offline';
