import { db } from '@/lib/db/dexie';
import { generateId } from '@/lib/utils';
import type { SyncOperationType } from '@/types/sync';

export type SyncableTable =
  | 'workout_logs'
  | 'programs'
  | 'profiles'
  | 'pr_records'
  | 'bodyweight_entries';

/**
 * Enqueue a sync operation for later processing by the SyncEngine.
 *
 * @param tableName - The Supabase table to sync to
 * @param operationType - 'create', 'update', or 'delete'
 * @param recordId - The ID of the record being synced
 * @param payload - The full record payload to upsert, or partial data for delete
 */
export async function enqueue(
  tableName: SyncableTable,
  operationType: SyncOperationType,
  recordId: string,
  payload: Record<string, unknown>
): Promise<void> {
  await db.syncQueue.add({
    id: generateId(),
    tableName,
    operationType,
    recordId,
    payload,
    createdAt: new Date().toISOString(),
    retryCount: 0,
  });
}
