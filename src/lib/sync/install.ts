/**
 * Installing sync into the app repository. This module is imported by the
 * providers tree on every page, so it stays tiny: the real adapter (./index,
 * mapper, supabase-js) is loaded with a dynamic `import()` by the deferred
 * adapter. Flag off: nothing is installed and nothing is loaded.
 */
import { noopSyncAdapter, type SyncAdapter } from '@/contracts/sync';
import { setRepositorySyncAdapter } from '@/lib/db';
import { isSyncEnabled } from '@/lib/supabase/env';
import { createDeferredSyncAdapter, type DeferredSyncAdapter } from './deferred';

let installed: SyncAdapter = noopSyncAdapter;

export { isSyncEnabled };

/**
 * Installs sync into the app repository (idempotent) and returns what is
 * installed: an enabled `DeferredSyncAdapter`, or `noopSyncAdapter` when the
 * flag is off, the Supabase env is missing, or this runs on the server.
 * Called at module init of the providers tree and again at the start of
 * AppBootstrap, so it is in place before the app's first repository write.
 */
export function installSyncAdapter(): SyncAdapter {
  if (typeof window === 'undefined' || installed.enabled || !isSyncEnabled()) return installed;
  installed = createDeferredSyncAdapter(async () => (await import('./index')).getSyncAdapter());
  setRepositorySyncAdapter(installed);
  return installed;
}

/** What `installSyncAdapter()` put into the repository (`noopSyncAdapter` until then). */
export function getInstalledSyncAdapter(): SyncAdapter {
  return installed;
}

/** The installed deferred adapter, or null (flag off / not installed). */
export function getDeferredSyncAdapter(): DeferredSyncAdapter | null {
  return installed.enabled && 'load' in installed ? (installed as DeferredSyncAdapter) : null;
}

/** Tests only: uninstall. */
export function resetInstalledSyncAdapterForTests(): void {
  if (installed !== noopSyncAdapter) setRepositorySyncAdapter(noopSyncAdapter);
  installed = noopSyncAdapter;
}
