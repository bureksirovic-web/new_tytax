'use client';

import { useMemo } from 'react';
import type { Profile, ProfileSettings } from '@/contracts/domain';
import type { Repository } from '@/contracts/repo';
import { useRepo } from './use-repo';
import { toRepoError } from './use-profiles';

export interface ProfileActions {
  /** Creates a profile; it does not become active (call `switchTo`). */
  create(name: string, settings?: Partial<ProfileSettings>): Promise<Profile>;
  rename(id: string, name: string): Promise<Profile>;
  /** Makes `id` the device's active profile. */
  switchTo(id: string): Promise<void>;
  /** Deletes the profile and only its data; if it was active, another profile becomes active. */
  remove(id: string): Promise<void>;
  updateSettings(id: string, patch: Partial<ProfileSettings>): Promise<Profile>;
}

/** Runs `op`, rejecting with a `RepoError` whatever the data layer threw. */
async function guarded<T>(op: () => Promise<T>): Promise<T> {
  try {
    return await op();
  } catch (error) {
    throw toRepoError(error);
  }
}

export function createProfileActions(repo: Repository): ProfileActions {
  return {
    create: (name, settings) => guarded(() => repo.profiles.create({ name, settings })),
    rename: (id, name) => guarded(() => repo.profiles.update(id, { name })),
    switchTo: (id) => guarded(() => repo.profiles.setActive(id)),
    remove: (id) => guarded(() => repo.profiles.remove(id)),
    updateSettings: (id, patch) => guarded(() => repo.profiles.updateSettings(id, patch)),
  };
}

/** Family-profile mutations. Hooks reading profiles (`useProfiles`, `useActiveProfile`) update live. */
export function useProfileActions(): ProfileActions {
  const repo = useRepo();
  return useMemo(() => createProfileActions(repo), [repo]);
}
