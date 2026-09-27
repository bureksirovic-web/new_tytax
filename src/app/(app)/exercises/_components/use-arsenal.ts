'use client';
import { useCallback, useMemo } from 'react';
import { useActiveProfile, useRepoQuery } from '@/hooks/use-repo';
import { getRepository } from '@/lib/db';

export interface ArsenalState {
  /** Favourite exercise ids of the active profile; undefined while loading. */
  ids: ReadonlySet<string> | undefined;
  profileId: string | undefined;
  /** Adds or removes; resolves to the new state (true = now a favourite). */
  toggle: (exerciseId: string) => Promise<boolean>;
}

const NO_IDS: ReadonlySet<string> = new Set();

/** The active profile's Arsenal (favourites), live from the repository. */
export function useArsenal(): ArsenalState {
  const { profileId, loading: profileLoading } = useActiveProfile();
  const { data } = useRepoQuery(
    (repo) => (profileId ? repo.arsenal.list(profileId) : Promise.resolve(undefined)),
    [profileId],
  );
  // No active profile (once known) = an empty Arsenal, not an endless skeleton.
  const ids = useMemo(() => {
    if (!profileId) return profileLoading ? undefined : NO_IDS;
    return data ? new Set(data.map((e) => e.exerciseId)) : undefined;
  }, [data, profileId, profileLoading]);

  const toggle = useCallback(
    async (exerciseId: string) => {
      if (!profileId) throw new Error('no active profile');
      const repo = getRepository();
      if (await repo.arsenal.has(profileId, exerciseId)) {
        await repo.arsenal.remove(profileId, exerciseId);
        return false;
      }
      await repo.arsenal.add(profileId, exerciseId);
      return true;
    },
    [profileId],
  );

  return { ids, profileId, toggle };
}
