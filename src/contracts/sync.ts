/**
 * TYTAX v2 — frozen sync contract (Wave 0, 2026-09-26).
 *
 * Flow: the repository (G2, Dexie) writes a `SyncOperation` row into its
 * outbox *inside the same transaction* as every mutation, but only when
 * `SyncAdapter.enabled` is true. After the commit it calls
 * `notifyChanged()`. The adapter (G5) drains the outbox (push), pulls remote
 * rows per table cursor and hands them to `Repository.applyRemote`
 * (last-write-wins on server `updatedAt`, tombstones via `deletedAt`).
 *
 * With `NEXT_PUBLIC_SYNC_ENABLED` unset the app uses `noopSyncAdapter`:
 * `enabled` is false, nothing is queued and no network call is ever made.
 */

/** Remote table names (snake_case, as in Supabase). */
export type SyncTable =
  | 'profiles'
  | 'workout_logs'
  | 'programs'
  | 'pr_records'
  | 'bodyweight_entries'
  | 'exercise_notes'
  | 'arsenal'
  | 'equipment';

export const SYNC_TABLES: readonly SyncTable[] = Object.freeze([
  'profiles',
  'workout_logs',
  'programs',
  'pr_records',
  'bodyweight_entries',
  'exercise_notes',
  'arsenal',
  'equipment',
]);

export type SyncOperationType = 'upsert' | 'delete';

/**
 * An outbox row. It names the record; the adapter reads the record's current
 * local state at push time (so repeated edits collapse into one upsert).
 */
export interface SyncOperation {
  id: string;
  table: SyncTable;
  op: SyncOperationType;
  recordId: string;
  profileId: string;
  createdAt: string;
  retryCount: number;
  lastError?: string;
}

/** Per-table pull cursor, persisted locally. */
export interface SyncCursor {
  table: SyncTable;
  accountId: string;
  /** Server `updated_at` of the last pulled row. */
  lastPulledAt: string | null;
  lastPushedAt: string | null;
}

export type SyncStatus = 'disabled' | 'idle' | 'syncing' | 'error' | 'offline';

export interface SyncState {
  status: SyncStatus;
  /** ISO timestamp of the last fully successful sync. */
  lastSyncedAt: string | null;
  pending: number;
  lastError?: string;
}

export interface SyncResult {
  pushed: number;
  pulled: number;
  failed: number;
  state: SyncState;
}

/** Implemented by the repository; drained by the adapter. */
export interface SyncOutbox {
  /** Oldest first. */
  peek(limit: number): Promise<SyncOperation[]>;
  ack(ids: readonly string[]): Promise<void>;
  fail(id: string, error: string): Promise<void>;
  count(): Promise<number>;
}

export interface ApplyRemoteResult {
  applied: number;
  /** Rows ignored because the local copy is newer (LWW). */
  skipped: number;
}

export interface SyncAdapter {
  readonly enabled: boolean;
  /** Called by the repository after a committed mutation that queued ops. */
  notifyChanged(): void;
  /** Push, then pull. Never throws; failures land in the returned state. */
  syncNow(): Promise<SyncResult>;
  getState(): SyncState;
  subscribe(listener: (state: SyncState) => void): () => void;
}

const DISABLED_STATE: SyncState = Object.freeze({
  status: 'disabled',
  lastSyncedAt: null,
  pending: 0,
}) as SyncState;

/** The adapter used when sync is off: no queue, no network. */
export const noopSyncAdapter: SyncAdapter = Object.freeze({
  enabled: false,
  notifyChanged: () => {},
  syncNow: async () => ({ pushed: 0, pulled: 0, failed: 0, state: DISABLED_STATE }),
  getState: () => DISABLED_STATE,
  subscribe: () => () => {},
});
