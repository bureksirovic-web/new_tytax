'use client';
import { useEffect, useMemo, useState } from 'react';
import type { Profile, Program, WorkoutLog } from '@/contracts/domain';
import type { RecoverySummary } from '@/contracts/training';
import { useActiveProfile, useRepoQuery } from '@/hooks/use-repo';
import { useCatalog } from '@/hooks/use-exercises';
import { training } from '@/lib/training';
import { recoveryRangeStart, volumeRangeStart, weeklyVolume, type WeeklyVolume } from './dashboard-math';

/** The current time, refreshed every minute so "today" and the 48 h window stay current. */
export function useNow(intervalMs = 60_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

export interface DashboardData {
  /** True until the profile and the first repository results are in. */
  loading: boolean;
  profile: Profile | undefined;
  program: Program | undefined;
  lastLog: WorkoutLog | undefined;
  volume: WeeklyVolume;
  /** Undefined while the exercise catalog loads (or when it failed: see `recoveryFailed`). */
  recovery: RecoverySummary | undefined;
  /** The exercise catalog could not load, so recovery cannot be computed. */
  recoveryFailed: boolean;
  /** A repository read failed: the empty states would be a lie, show an error instead. */
  failed: boolean;
}

/** Everything the dashboard shows, scoped to the active profile; soft-deleted rows are hidden by the repository. */
export function useDashboardData(now: Date): DashboardData {
  const { profile, profileId, loading: profileLoading } = useActiveProfile();
  const today = useMemo(() => now.toDateString(), [now]);
  // Recomputed per calendar day only, so the query is not re-subscribed every minute.
  const from = useMemo(() => {
    const a = volumeRangeStart(now);
    const b = recoveryRangeStart(now);
    return a < b ? a : b;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed by calendar day
  }, [today]);

  const programQ = useRepoQuery(
    async (repo) => (profileId ? ((await repo.programs.getActive(profileId)) ?? null) : null),
    [profileId],
  );
  const lastQ = useRepoQuery(
    async (repo) => (profileId ? ((await repo.logs.list(profileId, { limit: 1 }))[0] ?? null) : null),
    [profileId],
  );
  const recentQ = useRepoQuery(
    async (repo) => (profileId ? repo.logs.list(profileId, { from }) : []),
    [profileId, from],
  );
  const { catalog, error: catalogError } = useCatalog();

  const recent = recentQ.data;
  const volume = useMemo(() => weeklyVolume(recent ?? [], now), [recent, now]);
  const recovery = useMemo(() => {
    if (!catalog || !recent) return undefined;
    return training.recoveryStatus(recent, (id) => catalog.getById(id), now);
  }, [catalog, recent, now]);

  const loading =
    profileLoading || (profileId !== undefined && (programQ.loading || lastQ.loading || recentQ.loading));

  return {
    loading,
    profile,
    program: programQ.data ?? undefined,
    lastLog: lastQ.data ?? undefined,
    volume,
    recovery,
    recoveryFailed: !catalog && catalogError !== undefined,
    failed: !loading && (programQ.error !== undefined || lastQ.error !== undefined || recentQ.error !== undefined),
  };
}
