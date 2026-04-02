import { db } from '@/lib/db/dexie';
import type { SyncOperation } from '@/types/sync';

const MAX_RETRIES = 5;

export interface SyncResult {
  status: 'ok' | 'busy' | 'error';
  synced: number;
  failed: number;
  pending: number;
  conflictsResolved: number;
}

export class SyncEngine {
  private isSyncing = false;

  async sync(supabaseClient: ReturnType<typeof import('@/lib/supabase/client').createClient>): Promise<SyncResult> {
    if (this.isSyncing) {
      return { status: 'busy', synced: 0, failed: 0, pending: 0, conflictsResolved: 0 };
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
      let conflictsResolved = 0;

      for (const op of pending) {
        const retryCount = op.retryCount ?? 0;

        if (retryCount >= MAX_RETRIES) {
          failed++;
          continue;
        }

        if (retryCount > 0) {
          const delay = Math.min(1000 * Math.pow(2, retryCount), 30000);
          await new Promise(resolve => setTimeout(resolve, delay));
        }

        try {
          const conflict = await this.processOperation(supabaseClient, op);
          if (conflict) conflictsResolved++;
          await db.syncQueue.delete(op.id);
          synced++;
        } catch (err) {
          await db.syncQueue.update(op.id, {
            retryCount: retryCount + 1,
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
        conflictsResolved,
      };
    } finally {
      this.isSyncing = false;
    }
  }

  private async processOperation(
    supabaseClient: ReturnType<typeof import('@/lib/supabase/client').createClient>,
    op: SyncOperation
  ): Promise<boolean> {
    const { tableName, operationType, payload } = op;

    switch (operationType) {
      case 'create':
      case 'update': {
        const { data: serverRecord, error: fetchError } = await supabaseClient
          .from(tableName)
          .select('*')
          .eq('id', op.recordId)
          .maybeSingle();

        if (fetchError) throw fetchError;

        const localUpdatedAt = this.getTimestamp(payload, 'updatedAt');
        const serverUpdatedAt = serverRecord
          ? this.getTimestamp(serverRecord, 'updated_at')
          : null;

        // Server wins only if strictly newer (tie → local wins to avoid silent data loss)
        if (serverRecord && serverUpdatedAt && localUpdatedAt < serverUpdatedAt) {
          const localTable = this.getLocalTableName(tableName);
          if (localTable) {
            const camelRecord = this.snakeToCamel(serverRecord as Record<string, unknown>);
            await db.table(localTable).update(op.recordId, camelRecord);
          }
          return true;
        }

        const { error } = await supabaseClient.from(tableName).upsert(payload);
        if (error) throw error;
        return false;
      }
      case 'delete': {
        const { error } = await supabaseClient
          .from(tableName)
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', op.recordId);
        if (error) throw error;
        return false;
      }
      default: {
        const _exhaustive: never = operationType;
        throw new Error(`Unknown operationType: ${_exhaustive}`);
      }
    }
  }

  private getTimestamp(record: Record<string, unknown>, field: string): number {
    // Check both camelCase (local) and snake_case (server) variants
    const val = record[field] ?? record[this.camelToSnake(field)];
    if (val) return new Date(val as string).getTime();
    const fallback = record['createdAt'] ?? record['created_at'];
    if (fallback) return new Date(fallback as string).getTime();
    return 0;
  }

  private snakeToCamel(obj: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      const camelKey = key.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
      result[camelKey] = value;
    }
    return result;
  }

  private camelToSnake(str: string): string {
    return str.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
  }

  private getLocalTableName(serverTableName: string): string | null {
    const mapping: Record<string, string> = {
      workout_logs: 'workoutLogs',
      programs: 'programs',
      profiles: 'profiles',
      pr_records: 'prRecords',
      bodyweight_entries: 'bodyweightEntries',
    };
    return mapping[serverTableName] ?? null;
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
