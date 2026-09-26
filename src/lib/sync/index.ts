/**
 * Sync entry point. With `NEXT_PUBLIC_SYNC_ENABLED !== 'true'` or no Supabase
 * env, `getSyncAdapter()` is `noopSyncAdapter`: nothing is queued and no
 * network call is made. supabase-js is loaded with a dynamic `import()` only
 * inside the enabled branch, and only when something first syncs.
 */
import { noopSyncAdapter, type SyncAdapter } from '@/contracts/sync';
import { getRepository } from '@/lib/db';
import { getSupabaseEnv } from '@/lib/supabase/env';
import { createSupabaseSyncAdapter, type SupabaseSyncAdapter } from './adapter';
import { browserStorage } from './cursors';
import { createLazyRemoteStore, createSupabaseRemoteStore } from './remote';
import { resetInstalledSyncAdapterForTests } from './install';

export { createSupabaseSyncAdapter, backoffDelay, type SupabaseSyncAdapter, type SupabaseSyncAdapterOptions } from './adapter';
export { startAutoSync, type AutoSyncEnv } from './auto-sync';
export { createDeferredSyncAdapter, type DeferredSyncAdapter } from './deferred';
export { getDeferredSyncAdapter, getInstalledSyncAdapter, installSyncAdapter, isSyncEnabled, resetInstalledSyncAdapterForTests } from './install';
export { browserStorage, createCursorStore, safeStorage, type SyncStorage } from './cursors';
export { classifyRemoteError, type RemoteError } from './errors';
export { getAccountStore, createAccountStore, resetAccountStoreForTests, DISABLED_ACCOUNT, type AccountState, type AccountStatus, type AccountStore, type AuthClientLike } from './account';
export { fromRemote, toRemote, SyncMapError, isUuid } from './mapper';
export { createSupabaseRemoteStore, createLazyRemoteStore, type RemoteStore } from './remote';

let cached: SupabaseSyncAdapter | null = null;

export function getSyncAdapter(): SyncAdapter {
  if (process.env.NEXT_PUBLIC_SYNC_ENABLED !== 'true' || getSupabaseEnv() === null) return noopSyncAdapter;
  if (!cached) {
    cached = createSupabaseSyncAdapter({
      repo: getRepository,
      storage: browserStorage(),
      remote: createLazyRemoteStore(async () => {
        const { createClient } = await import('@/lib/supabase/client');
        return createSupabaseRemoteStore(createClient());
      }),
    });
  }
  return cached;
}

/** The enabled adapter's extra surface (markOffline, remote), or null for the no-op one. */
export function asSupabaseSyncAdapter(adapter: SyncAdapter): SupabaseSyncAdapter | null {
  return adapter.enabled && 'markOffline' in adapter ? (adapter as SupabaseSyncAdapter) : null;
}

/** Tests only: forget the cached adapter and uninstall it. */
export function resetSyncAdapterForTests(): void {
  cached?.dispose();
  cached = null;
  resetInstalledSyncAdapterForTests();
}
