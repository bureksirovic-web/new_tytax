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
  const existing = await db.syncQueue.where({ recordId, tableName }).first();

  if (existing) {
    if (operationType === 'delete') {
      await db.syncQueue.update(existing.id, {
        operationType: 'delete',
        payload,
        createdAt: new Date().toISOString(),
      });
    } else {
      await db.syncQueue.update(existing.id, {
        operationType: existing.operationType === 'delete' ? 'delete' : operationType,
        payload,
        createdAt: new Date().toISOString(),
      });
    }
  } else {
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
}
