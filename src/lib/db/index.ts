/**
 * Data layer entry point. Everything outside src/lib/db goes through
 * `getRepository()` (or the hooks in src/hooks/use-repo.ts), never Dexie.
 */
import type { Repository } from '@/contracts/repo';
import { noopSyncAdapter, type SyncAdapter, type SyncResult, type SyncState } from '@/contracts/sync';
import { createRepository } from './repository';

export { createRepository, type CreateRepositoryOptions } from './repository';
export { getDb, TytaxDatabase, DB_VERSION, DEFAULT_DB_NAME, type MetaRow } from './dexie';
export { ACTIVE_PROFILE_KEY } from './repo/profiles';

let currentAdapter: SyncAdapter = noopSyncAdapter;
let singleton: Repository | undefined;

/**
 * Forwards to whichever adapter `setRepositorySyncAdapter` installed last, so
 * the singleton never needs rebuilding when sync is switched on or off.
 */
const forwardingAdapter: SyncAdapter = {
  get enabled() {
    return currentAdapter.enabled;
  },
  notifyChanged: () => currentAdapter.notifyChanged(),
  syncNow: (): Promise<SyncResult> => currentAdapter.syncNow(),
  getState: (): SyncState => currentAdapter.getState(),
  subscribe: (listener) => currentAdapter.subscribe(listener),
};

/** The app-wide repository (lazy; constructing it never opens IndexedDB). */
export function getRepository(): Repository {
  if (!singleton) singleton = createRepository({ sync: forwardingAdapter });
  return singleton;
}

/** Installs the sync adapter the app repository queues for (default: no-op, nothing queued). */
export function setRepositorySyncAdapter(adapter: SyncAdapter): void {
  currentAdapter = adapter;
}
