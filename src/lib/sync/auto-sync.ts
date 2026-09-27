/**
 * Automatic sync triggers: back online, tab visible again, signed in or token
 * refreshed. Returns `stop()`, which removes every listener.
 */
import type { SyncAdapter } from '@/contracts/sync';
import type { RemoteStore } from './remote';

interface EventTargetLike {
  addEventListener(type: string, listener: () => void): void;
  removeEventListener(type: string, listener: () => void): void;
}

interface DocumentLike extends EventTargetLike {
  readonly visibilityState: string;
}

export interface AutoSyncEnv {
  /** Default `window` (when present). */
  window?: EventTargetLike | null;
  /** Default `document` (when present). */
  document?: DocumentLike | null;
  /** Default: the adapter's remote, when it exposes one. */
  onAuthChange?: RemoteStore['onAuthChange'] | null;
}

export interface AutoSyncTarget extends SyncAdapter {
  readonly remote?: RemoteStore;
  markOffline?(): void;
}

export const AUTH_SYNC_EVENTS: ReadonlySet<string> = new Set(['SIGNED_IN', 'TOKEN_REFRESHED']);

export function startAutoSync(adapter: AutoSyncTarget, env: AutoSyncEnv = {}): () => void {
  if (!adapter.enabled) return () => {};
  const win = env.window !== undefined ? env.window : typeof window === 'undefined' ? null : window;
  const doc = env.document !== undefined ? env.document : typeof document === 'undefined' ? null : document;
  const onAuthChange = env.onAuthChange !== undefined ? env.onAuthChange : adapter.remote?.onAuthChange.bind(adapter.remote);

  const sync = (): void => {
    void adapter.syncNow();
  };
  const offline = (): void => adapter.markOffline?.();
  const visible = (): void => {
    if (doc?.visibilityState === 'visible') sync();
  };

  win?.addEventListener('online', sync);
  win?.addEventListener('offline', offline);
  doc?.addEventListener('visibilitychange', visible);
  const unsubscribeAuth = onAuthChange?.((event) => {
    if (AUTH_SYNC_EVENTS.has(event)) sync();
  });

  return () => {
    win?.removeEventListener('online', sync);
    win?.removeEventListener('offline', offline);
    doc?.removeEventListener('visibilitychange', visible);
    unsubscribeAuth?.();
  };
}
