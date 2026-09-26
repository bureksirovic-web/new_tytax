/**
 * The narrow remote the sync adapter talks to, plus its supabase-js
 * implementation. Only type imports of supabase-js here: the client itself is
 * created lazily (see ./index.ts), so a disabled flag never loads it.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { NETWORK_ERROR, classifyRemoteError, type RemoteError } from './errors';
import type { RemoteRow } from './mapper';

export type { RemoteError } from './errors';

export interface UpsertedRow {
  id: string;
  updated_at: string;
  /** The server keeps a tombstone on upsert (sticky, migration 002); non-null here means the row is still deleted. */
  deleted_at: string | null;
}

export type UpsertResult = { ok: true; rows: UpsertedRow[] } | { ok: false; error: RemoteError };
export type UndeleteResult = { ok: true; restored: boolean } | { ok: false; error: RemoteError };
export type PullResult = { ok: true; rows: RemoteRow[] } | { ok: false; error: RemoteError };

/** Supabase auth events the adapter reacts to (SIGNED_IN, TOKEN_REFRESHED, SIGNED_OUT, …). */
export type AuthChangeListener = (event: string, accountId: string | null) => void;

export interface RemoteStore {
  /** Upsert by `id`; the server sets `updated_at`. All-or-nothing per call. */
  upsert(remoteTable: string, rows: readonly RemoteRow[]): Promise<UpsertResult>;
  /**
   * Rows ordered by (`updated_at`, `id`). `afterId === null`: `updated_at >= since`
   * (the caller applies the overlap); otherwise keyset: strictly after (`since`, `afterId`).
   */
  pull(remoteTable: string, since: string | null, afterId: string | null, limit: number): Promise<PullResult>;
  /** `public.undelete_row(table, id)`: the only way to clear a tombstone (RLS applies). */
  undelete(remoteTable: string, id: string): Promise<UndeleteResult>;
  currentAccountId(): Promise<string | null>;
  onAuthChange(cb: AuthChangeListener): () => void;
}

interface PostgrestLikeError {
  code?: string | null;
}

function failure(status: number | undefined, error: PostgrestLikeError | null): { ok: false; error: RemoteError } {
  return { ok: false, error: classifyRemoteError({ status, code: error?.code }) };
}

/** Double-quoted PostgREST filter value (timestamps contain ':' and '+'). */
function q(v: string): string {
  return `"${v.replace(/["\\]/g, '')}"`;
}

export function createSupabaseRemoteStore(client: SupabaseClient): RemoteStore {
  return {
    async upsert(remoteTable, rows) {
      if (rows.length === 0) return { ok: true, rows: [] };
      try {
        const res = await client
          .from(remoteTable)
          .upsert(rows as RemoteRow[], { onConflict: 'id' })
          .select('id, updated_at, deleted_at');
        if (res.error) return failure(res.status, res.error);
        return { ok: true, rows: (res.data ?? []) as UpsertedRow[] };
      } catch {
        return { ok: false, error: NETWORK_ERROR };
      }
    },

    async pull(remoteTable, since, afterId, limit) {
      try {
        let query = client.from(remoteTable).select('*');
        if (since !== null && afterId !== null) {
          query = query.or(`updated_at.gt.${q(since)},and(updated_at.eq.${q(since)},id.gt.${q(afterId)})`);
        } else if (since !== null) {
          query = query.gte('updated_at', since);
        }
        const res = await query.order('updated_at', { ascending: true }).order('id', { ascending: true }).limit(limit);
        if (res.error) return failure(res.status, res.error);
        return { ok: true, rows: (res.data ?? []) as RemoteRow[] };
      } catch {
        return { ok: false, error: NETWORK_ERROR };
      }
    },

    async undelete(remoteTable, id) {
      try {
        const res = await client.rpc('undelete_row', { p_table: remoteTable, p_id: id });
        if (res.error) return failure(res.status, res.error);
        return { ok: true, restored: res.data === true };
      } catch {
        return { ok: false, error: NETWORK_ERROR };
      }
    },

    async currentAccountId() {
      const { data } = await client.auth.getSession();
      return data.session?.user?.id ?? null;
    },

    onAuthChange(cb) {
      const { data } = client.auth.onAuthStateChange((event, session) => cb(event, session?.user?.id ?? null));
      return () => data.subscription.unsubscribe();
    },
  };
}

/**
 * A RemoteStore that builds the real one on first use. Used by
 * `getSyncAdapter()` so supabase-js is imported only when sync is enabled
 * and something actually syncs.
 */
export function createLazyRemoteStore(load: () => Promise<RemoteStore>): RemoteStore {
  let pending: Promise<RemoteStore> | null = null;
  const get = (): Promise<RemoteStore> => {
    if (!pending) {
      pending = load().catch((e: unknown) => {
        pending = null;
        throw e;
      });
    }
    return pending;
  };
  return {
    async upsert(t, rows) {
      try {
        return (await get()).upsert(t, rows);
      } catch {
        return { ok: false, error: NETWORK_ERROR };
      }
    },
    async pull(t, since, afterId, limit) {
      try {
        return (await get()).pull(t, since, afterId, limit);
      } catch {
        return { ok: false, error: NETWORK_ERROR };
      }
    },
    async undelete(t, id) {
      try {
        return (await get()).undelete(t, id);
      } catch {
        return { ok: false, error: NETWORK_ERROR };
      }
    },
    currentAccountId: async () => (await get()).currentAccountId(),
    onAuthChange(cb) {
      let unsubscribe: (() => void) | null = null;
      let stopped = false;
      get().then(
        (store) => {
          if (!stopped) unsubscribe = store.onAuthChange(cb);
        },
        () => {},
      );
      return () => {
        stopped = true;
        unsubscribe?.();
      };
    },
  };
}
