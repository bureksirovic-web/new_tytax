import { getDb } from '@/lib/db/dexie';
import { generateId } from '@/lib/utils';
import type { SyncOperationType, SyncTable } from '@/types/sync';

export type SyncableTable = SyncTable;

/** Legacy callers still pass 'create' / 'update'; both map to 'upsert'. */
export type EnqueueOperation = SyncOperationType | 'create' | 'update';

function toOp(operationType: EnqueueOperation): SyncOperationType {
  return operationType === 'delete' ? 'delete' : 'upsert';
}

/**
 * Enqueue a sync operation for later processing by the SyncEngine.
 *
 * The v3 outbox row names the record only; the payload is read from the
 * local table at push time. `payload.profileId` is recorded when present.
 *
 * @param tableName - The Supabase table to sync to
 * @param operationType - 'upsert' (or legacy 'create'/'update') or 'delete'
 * @param recordId - The ID of the record being synced
 * @param payload - The record (only its profileId is kept)
 */
export async function enqueue(
  tableName: SyncableTable,
  operationType: EnqueueOperation,
  recordId: string,
  payload: Record<string, unknown>
): Promise<void> {
  const db = getDb();
  const op = toOp(operationType);
  const profileId = typeof payload.profileId === 'string' ? payload.profileId : '';
  const existing = await db.syncQueue.where({ recordId, table: tableName }).first();

  if (existing) {
    await db.syncQueue.update(existing.id, {
      // delete supersedes create/update, and stays a delete
      op: op === 'delete' || existing.op === 'delete' ? 'delete' : 'upsert',
      profileId: profileId || existing.profileId,
      createdAt: new Date().toISOString(),
    });
  } else {
    await db.syncQueue.add({
      id: generateId(),
      table: tableName,
      op,
      recordId,
      profileId,
      createdAt: new Date().toISOString(),
      retryCount: 0,
    });
  }
}
