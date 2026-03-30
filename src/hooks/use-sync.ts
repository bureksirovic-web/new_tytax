'use client';
import { useLiveQuery } from 'dexie-react-hooks';
import { useCallback, useState } from 'react';
import { db } from '@/lib/db/dexie';
import { syncEngine, type SyncResult } from '@/lib/sync/engine';
import { createClient } from '@/lib/supabase/client';

export function useSync() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastResult, setLastResult] = useState<SyncResult | null>(null);

  // Count items still in the queue (all items are pending by definition —
  // successfully synced items are deleted from the queue by the engine)
  const pendingCount = useLiveQuery(() => db.syncQueue.count(), []);

  // Get the most recent sync metadata entry for this device
  const lastSyncMeta = useLiveQuery(async () => {
    const deviceId =
      typeof window !== 'undefined'
        ? (localStorage.getItem('tytax_device_id') ?? undefined)
        : undefined;
    if (!deviceId) return undefined;
    return db.syncMetadata.where('deviceId').equals(deviceId).first();
  }, []);

  const sync = useCallback(async () => {
    setIsSyncing(true);
    try {
      const supabase = createClient();
      const result = await syncEngine.sync(supabase);
      setLastResult(result);
    } finally {
      setIsSyncing(false);
    }
  }, []);

  return {
    isSyncing,
    pendingCount: pendingCount ?? 0,
    lastSync: lastSyncMeta?.lastSyncedAt ?? null,
    lastResult,
    sync,
  };
}
