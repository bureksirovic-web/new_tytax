'use client';
import { useCallback } from 'react';
import type { Profile, Program } from '@/contracts/domain';
import { useActiveProfile, useRepoQuery } from '@/hooks/use-repo';
import { useUIStore } from '@/stores/ui-store';

export type ProgramState =
  | { status: 'loading'; program: undefined; profile: Profile | undefined }
  | { status: 'missing'; program: undefined; profile: Profile | undefined }
  | { status: 'ready'; program: Program; profile: Profile };

/**
 * One program of the active profile (live). `missing` when the id does not
 * exist, is soft-deleted or belongs to another profile — never an endless spinner.
 */
export function useProgram(id: string): ProgramState {
  const { profile, profileId, loading: profileLoading } = useActiveProfile();
  const { data, loading } = useRepoQuery(
    async (r) => (profileId ? ((await r.programs.get(profileId, id)) ?? null) : null),
    [profileId, id],
  );
  if (profileLoading || loading) return { status: 'loading', program: undefined, profile };
  if (!data || !profile) return { status: 'missing', program: undefined, profile };
  return { status: 'ready', program: data, profile };
}

/** Runs a repository mutation; a failure shows `errorMessage` as an error toast. Returns false on failure. */
export function useMutationRunner(errorMessage: string) {
  const addToast = useUIStore((s) => s.addToast);
  return useCallback(
    async (fn: () => Promise<unknown>): Promise<boolean> => {
      try {
        await fn();
        return true;
      } catch {
        addToast(errorMessage, 'error');
        return false;
      }
    },
    [addToast, errorMessage],
  );
}
