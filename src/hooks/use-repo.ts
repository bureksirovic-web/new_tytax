'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Profile } from '@/contracts/domain';
import type { Repository } from '@/contracts/repo';
import { getRepository } from '@/lib/db';

/** The app repository. Safe during server rendering: nothing touches IndexedDB until a query runs. */
export function useRepo(): Repository {
  return getRepository();
}

export interface RepoQueryResult<T> {
  /** Result for the current `deps`; undefined until the first result for them arrives, and after a failed run. */
  data: T | undefined;
  /** Set when the latest run failed; it replaces `data` (stale data is never shown beside an error). */
  error: unknown;
  loading: boolean;
}

interface QueryState<T> {
  /** Identity of the deps the data belongs to. */
  token: object | null;
  data: T | undefined;
  error: unknown;
}

/**
 * Live repository query: runs `query` and re-runs it whenever the data it read
 * changes (`repo.watch`). Re-subscribes when `deps` change; unsubscribes on unmount.
 */
export function useRepoQuery<T>(query: (repo: Repository) => Promise<T>, deps: readonly unknown[]): RepoQueryResult<T> {
  const repo = useRepo();
  // A fresh identity per deps change; results are tagged with it so stale ones never show.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `deps` is the caller's dependency list
  const token = useMemo(() => ({}), deps);
  const [state, setState] = useState<QueryState<T>>({ token: null, data: undefined, error: undefined });

  useEffect(() => {
    const unsubscribe = repo.watch(
      () => query(repo),
      (data) => setState({ token, data, error: undefined }),
      (error) => setState({ token, data: undefined, error }),
    );
    return unsubscribe;
    // `query` is intentionally read from the render that produced `token`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repo, token]);

  const current = state.token === token;
  return {
    data: current ? state.data : undefined,
    error: current ? state.error : undefined,
    loading: !current,
  };
}

export interface ActiveProfileResult {
  profile: Profile | undefined;
  profileId: string | undefined;
  loading: boolean;
  /** Set when reading the active profile failed (profile and profileId are then undefined). */
  error: unknown;
}

/**
 * The device's active profile (live: follows `setActive`, and `remove` of the
 * active profile). A soft-deleted or missing active id reads as no profile.
 * Use `repo.profiles.ensureActive` at app start to guarantee one.
 */
export function useActiveProfile(): ActiveProfileResult {
  const { data, loading, error } = useRepoQuery(async (repo) => {
    const id = await repo.profiles.getActiveId();
    return id ? ((await repo.profiles.get(id)) ?? null) : null;
  }, []);
  return { profile: data ?? undefined, profileId: data?.id, loading, error };
}
