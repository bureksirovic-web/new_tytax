/**
 * Per-(account, table) pull/push cursors in localStorage under
 * `tytax.sync.cursor.v1.<accountId>.<table>` (docs/v2/sync-schema.md).
 * Storage is injectable; a throwing or missing localStorage degrades to an
 * in-memory copy (a lost cursor only means an idempotent full re-pull).
 */
import type { SyncTable } from '@/contracts/sync';

/** The subset of `Storage` the sync layer uses. */
export interface SyncStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const CURSOR_KEY_PREFIX = 'tytax.sync.cursor.v1.';
export const LAST_SYNCED_KEY = 'tytax.sync.last-synced-at.v1';
/** Pull overlap: covers transactions that commit out of `updated_at` order. */
export const PULL_OVERLAP_MS = 5_000;

export interface StoredCursor {
  /** Raw server `updated_at` of the last applied row (kept verbatim for keyset paging). */
  lastPulledAt: string | null;
  lastPulledId: string | null;
  /** Set after the first complete push for this account (the snapshot run). */
  lastPushedAt: string | null;
}

export interface CursorStore {
  get(accountId: string, table: SyncTable): StoredCursor;
  set(accountId: string, table: SyncTable, patch: Partial<StoredCursor>): void;
}

const EMPTY: StoredCursor = Object.freeze({ lastPulledAt: null, lastPulledId: null, lastPushedAt: null });

export function cursorKey(accountId: string, table: SyncTable): string {
  return `${CURSOR_KEY_PREFIX}${accountId}.${table}`;
}

function str(v: unknown): string | null {
  return typeof v === 'string' && v !== '' ? v : null;
}

function parse(raw: string | null): StoredCursor | null {
  if (!raw) return null;
  try {
    const v: unknown = JSON.parse(raw);
    if (typeof v !== 'object' || v === null) return null;
    const o = v as Record<string, unknown>;
    return { lastPulledAt: str(o.lastPulledAt), lastPulledId: str(o.lastPulledId), lastPushedAt: str(o.lastPushedAt) };
  } catch {
    return null;
  }
}

/** Wraps a storage so every call is safe; falls back to memory when it throws or is absent. */
export function safeStorage(getStorage: () => SyncStorage | null | undefined): SyncStorage {
  const memory = new Map<string, string>();
  const backing = (): SyncStorage | null => {
    try {
      return getStorage() ?? null;
    } catch {
      return null;
    }
  };
  return {
    getItem(key) {
      if (memory.has(key)) return memory.get(key) ?? null;
      try {
        return backing()?.getItem(key) ?? null;
      } catch {
        return null;
      }
    },
    setItem(key, value) {
      memory.set(key, value);
      try {
        backing()?.setItem(key, value);
      } catch {
        // Quota or privacy mode: the in-memory copy keeps this session consistent.
      }
    },
    removeItem(key) {
      memory.delete(key);
      try {
        backing()?.removeItem(key);
      } catch {
        // ignore
      }
    },
  };
}

/** `window.localStorage` behind `safeStorage` (SSR and privacy mode safe). */
export function browserStorage(): SyncStorage {
  return safeStorage(() => (typeof window === 'undefined' ? null : window.localStorage));
}

export function createCursorStore(storage: SyncStorage): CursorStore {
  const get = (accountId: string, table: SyncTable): StoredCursor =>
    parse(storage.getItem(cursorKey(accountId, table))) ?? { ...EMPTY };
  return {
    get,
    set(accountId, table, patch) {
      storage.setItem(cursorKey(accountId, table), JSON.stringify({ ...get(accountId, table), ...patch }));
    },
  };
}

/** First-page lower bound: `lastPulledAt − 5 s`, or null (pull everything). */
export function pullSince(cursor: StoredCursor, overlapMs = PULL_OVERLAP_MS): string | null {
  if (!cursor.lastPulledAt) return null;
  const t = Date.parse(cursor.lastPulledAt);
  if (!Number.isFinite(t)) return null;
  return new Date(t - overlapMs).toISOString();
}
