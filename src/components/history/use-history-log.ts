'use client';
import type { Profile, Units, WorkoutLog } from '@/contracts/domain';
import { useActiveProfile, useRepoQuery } from '@/hooks/use-repo';

export type LogStatus = 'loading' | 'ready' | 'missing';

export interface HistoryLogResult {
  status: LogStatus;
  log: WorkoutLog | undefined;
  profile: Profile | undefined;
  units: Units;
  /** Name of the log's program when it still resolves. */
  programName: string | undefined;
}

/**
 * One log of the active profile. `missing` (never an endless spinner) when the
 * id is unknown, soft-deleted, belongs to another profile, or there is no profile.
 */
export function useHistoryLog(id: string): HistoryLogResult {
  const { profile, profileId, loading: profileLoading } = useActiveProfile();
  const { data, loading, error } = useRepoQuery(async (repo) => {
    if (!profileId) return { log: null, programName: undefined };
    const log = (await repo.logs.get(profileId, id)) ?? null;
    const program = log?.programId ? await repo.programs.get(profileId, log.programId) : undefined;
    return { log, programName: program && !program.deletedAt ? program.name : undefined };
  }, [profileId, id]);

  const units: Units = profile?.settings.units ?? 'kg';
  let status: LogStatus;
  if (profileLoading || (loading && !error)) status = 'loading';
  else if (error || !data?.log) status = 'missing';
  else status = 'ready';
  return { status, log: data?.log ?? undefined, profile, units, programName: data?.programName };
}
