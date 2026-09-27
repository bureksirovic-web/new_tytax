/**
 * Cross-tab sync for the persisted stores (hardening F1). Every tab writes
 * its whole persisted state on each change, so a tab that still holds an
 * older copy in memory would overwrite another tab's newer work (e.g. a done
 * set) with its next write. `syncAcrossTabs` re-reads storage:
 * - on `storage` events for `key` (fired in every OTHER tab after a write),
 *   and for `key === null` (another tab cleared storage);
 * - when this tab becomes visible again (`visibilitychange` → 'visible').
 * Storage always holds the newest write of any tab (this tab's own writes are
 * already in it), so re-reading never loses this tab's work. No-op on the
 * server. Returns an unsubscribe function.
 */
export function syncAcrossTabs(key: string, rehydrate: () => unknown): () => void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return () => {};
  const onStorage = (e: StorageEvent): void => {
    if (e.key === key || e.key === null) void rehydrate();
  };
  const onVisibility = (): void => {
    if (document.visibilityState === 'visible') void rehydrate();
  };
  window.addEventListener('storage', onStorage);
  document.addEventListener('visibilitychange', onVisibility);
  return () => {
    window.removeEventListener('storage', onStorage);
    document.removeEventListener('visibilitychange', onVisibility);
  };
}
