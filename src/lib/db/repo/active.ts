import type { Profile } from '@/contracts/domain';
import { RepoError, type Repository } from '@/contracts/repo';

/**
 * The device's active profile, or `RepoError('NO_ACTIVE_PROFILE')` when none
 * is selected (or the selected one was deleted). For callers that must not
 * silently create a profile (use `profiles.ensureActive` for that).
 */
export async function requireActiveProfile(repo: Pick<Repository, 'profiles'>): Promise<Profile> {
  const id = await repo.profiles.getActiveId();
  const profile = id ? await repo.profiles.get(id) : undefined;
  if (!profile) throw new RepoError('NO_ACTIVE_PROFILE', 'No active profile on this device');
  return profile;
}
