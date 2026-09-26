'use client';

import type { Profile } from '@/contracts/domain';
import { isRepoError, RepoError } from '@/contracts/repo';
import { useRepoQuery } from './use-repo';

export interface ProfilesResult {
  /** Live profiles, oldest first; soft-deleted profiles are hidden. Empty while loading. */
  profiles: Profile[];
  loading: boolean;
  error: RepoError | undefined;
}

/** Normalises anything thrown by the data layer to a `RepoError` (typed `code`). */
export function toRepoError(error: unknown): RepoError {
  if (isRepoError(error)) return error;
  const message = error instanceof Error ? error.message : String(error);
  return new RepoError('STORAGE', message, error);
}

/** Every profile on this device (live: re-renders on create, rename, remove). */
export function useProfiles(): ProfilesResult {
  const { data, loading, error } = useRepoQuery((repo) => repo.profiles.list(), []);
  return {
    profiles: data ?? [],
    loading,
    error: error === undefined ? undefined : toRepoError(error),
  };
}
