'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { BodyweightEntry, Profile, Units, WorkoutLog } from '@/contracts/domain';
import type { Repository } from '@/contracts/repo';
import type { ExerciseLookup } from '@/contracts/training';
import { useActiveProfile, useRepoQuery } from '@/hooks/use-repo';
import { useCatalog } from '@/hooks/use-exercises';
import { localDay } from './analytics-dates';

export {
  MAX_PINNED, migrateStoredPins, pinsStorageKey, readPins, readStoredPins, sanitizePins, savePins, usePinnedExercises,
  type PinMigration, type SettingsWithPins,
} from './pinned-storage';
export { muscleVolumeKg } from './muscle-volume';

/** Local calendar day (`'YYYY-MM-DD'`) `days` days before `now`. */
export function localDayDaysAgo(days: number, now: Date = new Date()): string {
  return localDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - days));
}

/**
 * Clock for the analytics screen. Checked every `intervalMs`, but only replaced
 * when the local calendar day changes, so memoised maths does not churn every
 * minute while day windows still roll over past midnight in a long-open PWA.
 */
export function useNow(intervalMs = 60_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => {
      const next = new Date();
      setNow((cur) => (localDay(cur) === localDay(next) ? cur : next));
    }, intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

export interface ExerciseNames {
  lookup: ExerciseLookup | undefined;
  /** Catalog name, else the log's snapshot name, else the id. */
  nameOf: (id: string, fallback?: string) => string;
  catalogLoading: boolean;
  /** True when the catalog is loaded (or failed) and has no entry for `id`. */
  isUnknown: (id: string) => boolean;
}

export function useExerciseNames(): ExerciseNames {
  const { catalog, loading, error } = useCatalog();
  const lookup = useMemo<ExerciseLookup | undefined>(() => (catalog ? (id) => catalog.getById(id) : undefined), [catalog]);
  const nameOf = useCallback((id: string, fallback?: string) => catalog?.getById(id)?.name ?? fallback ?? id, [catalog]);
  const isUnknown = useCallback((id: string) => !loading && (Boolean(error) || !catalog?.getById(id)), [catalog, loading, error]);
  return { lookup, nameOf, catalogLoading: loading, isUnknown };
}

export interface AnalyticsData {
  loading: boolean;
  profileId: string | undefined;
  profile: Profile | undefined;
  units: Units;
  /** The active profile's live logs, whole history, newest first. */
  logs: WorkoutLog[];
  /** Exercise lookup from the lazy catalog; undefined while it loads (sections fall back to log snapshots). */
  lookup: ExerciseLookup;
  nameOf: ExerciseNames['nameOf'];
  catalogLoading: boolean;
  now: Date;
}

const EMPTY_LOOKUP: ExerciseLookup = () => undefined;

/** Everything the analytics screen reads: profile, units, logs (repository) and names (lazy catalog). */
export function useAnalyticsData(): AnalyticsData {
  const { profile, profileId, loading: profileLoading } = useActiveProfile();
  const { data: logs } = useRepoQuery(
    async (repo: Repository) => (profileId ? repo.logs.list(profileId) : []),
    [profileId],
  );
  const { lookup, nameOf, catalogLoading } = useExerciseNames();
  const now = useNow();
  return {
    loading: profileLoading || (profileId !== undefined && logs === undefined),
    profileId,
    profile,
    units: profile?.settings.units ?? 'kg',
    logs: logs ?? [],
    lookup: lookup ?? EMPTY_LOOKUP,
    nameOf,
    catalogLoading,
    now,
  };
}

/** Live logs containing `exerciseId`, newest first, for the active profile. */
export function useExerciseHistory(exerciseId: string) {
  const { profile, profileId, loading: profileLoading } = useActiveProfile();
  const { data } = useRepoQuery(
    async (repo: Repository) => (profileId ? repo.logs.historyFor(profileId, exerciseId) : []),
    [profileId, exerciseId],
  );
  return {
    logs: data ?? [],
    units: (profile?.settings.units ?? 'kg') as Units,
    loading: profileLoading || (profileId !== undefined && data === undefined),
  };
}

/** Bodyweight entries of the active profile, newest first. */
export function useBodyweightEntries(profileId: string | undefined) {
  const { data } = useRepoQuery(
    async (repo: Repository): Promise<BodyweightEntry[]> => (profileId ? repo.bodyweight.list(profileId) : []),
    [profileId],
  );
  return { entries: data ?? [], loading: data === undefined };
}
