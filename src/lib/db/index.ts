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

declare global {
  interface Window {
    /**
     * Interim e2e hook (docs/v2/requests/G2-01.md): the app repository, for
     * profile switch/remove until `E2EHooks` gains them. Never set in a
     * production build unless it ran with NEXT_PUBLIC_E2E_HOOKS=1.
     */
    __tytaxRepo?: Repository;
  }
}

/** Same guard as `AppBootstrap` uses for `window.__tytaxE2E`; inlined at build time. */
function e2eHooksEnabled(): boolean {
  return process.env.NODE_ENV !== 'production' || process.env.NEXT_PUBLIC_E2E_HOOKS === '1';
}

/** The app-wide repository (lazy; constructing it never opens IndexedDB). */
export function getRepository(): Repository {
  if (!singleton) {
    singleton = createRepository({ sync: forwardingAdapter });
    if (typeof window !== 'undefined' && e2eHooksEnabled()) window.__tytaxRepo = singleton;
  }
  return singleton;
}

/** Installs the sync adapter the app repository queues for (default: no-op, nothing queued). */
export function setRepositorySyncAdapter(adapter: SyncAdapter): void {
  currentAdapter = adapter;
}
