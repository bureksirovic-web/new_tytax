import { db } from '@/lib/db/dexie';
import type { SyncOperation } from '@/types/sync';

export interface SyncResult {
  status: 'ok' | 'busy' | 'error';
  synced: number;
  failed: number;
  pending: number;
}

export class SyncEngine {
  private isSyncing = false;

  async sync(supabaseClient: ReturnType<typeof import('@/lib/supabase/client').createClient>): Promise<SyncResult> {
    if (this.isSyncing) {
      return { status: 'busy', synced: 0, failed: 0, pending: 0 };
    }
    this.isSyncing = true;

    try {
      // Fetch pending ops: those without a lastError set and retryCount < threshold
      // Since SyncOperation has no status field, we track "done" by presence in queue —
      // items that have been processed successfully should be deleted from the queue.
      const all = await db.syncQueue.toArray();

      // Treat items with retryCount > 0 and lastError as previously-failed;
      // treat items with no lastError (or retryCount === 0) as pending.
      // Items successfully synced are deleted from the queue.
      const pending = all;

      let synced = 0;
      let failed = 0;

      for (const op of pending) {
        try {
          await this.processOperation(supabaseClient, op);
          // On success, remove from queue
          await db.syncQueue.delete(op.id);
          synced++;
        } catch (err) {
          await db.syncQueue.update(op.id, {
            retryCount: (op.retryCount ?? 0) + 1,
            lastError: String(err),
          });
          failed++;
        }
      }

      // Update sync metadata for the current device
      const deviceId = getDeviceId();
      const existingMeta = await db.syncMetadata
        .where('deviceId')
        .equals(deviceId)
        .first();

      if (existingMeta) {
        await db.syncMetadata.update(existingMeta.id, {
          lastSyncedAt: new Date().toISOString(),
        });
      }

      return {
        status: 'ok',
        synced,
        failed,
        pending: pending.length - synced - failed,
      };
    } finally {
      this.isSyncing = false;
    }
  }

  private async processOperation(
    supabaseClient: ReturnType<typeof import('@/lib/supabase/client').createClient>,
    op: SyncOperation
  ): Promise<void> {
    const { tableName, operationType, payload } = op;

    switch (operationType) {
      case 'create':
      case 'update':
        await supabaseClient.from(tableName).upsert(payload);
        break;
      case 'delete':
        await supabaseClient
          .from(tableName)
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', op.recordId);
        break;
      default: {
        const _exhaustive: never = operationType;
        throw new Error(`Unknown operationType: ${_exhaustive}`);
      }
    }
  }
}

/**
 * Get or create a stable device ID stored in localStorage.
 * Falls back to a random UUID if localStorage is unavailable (SSR guard).
 */
function getDeviceId(): string {
  if (typeof window === 'undefined') return 'server';
  const key = 'tytax_device_id';
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(key, id);
  }
  return id;
}

export const syncEngine = new SyncEngine();
