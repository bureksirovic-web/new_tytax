'use client';
import { useCallback, useMemo } from 'react';
import type { WorkoutLog } from '@/contracts/domain';
import type { ExerciseLookup } from '@/contracts/training';
import { useActiveProfile, useRepoQuery } from '@/hooks/use-repo';
import { useCatalog } from '@/hooks/use-exercises';
import { computeACWR } from '@/lib/analytics/acwr';
import { computeWeeklyVolume, volumeByMuscle } from '@/lib/analytics/volume';
import { getBestLifts, getE1RMProgression } from '@/lib/analytics/pr-tracker';
import { analyzeMuscleGaps } from '@/lib/analytics/gap-analysis';
import { computeVolumeParity } from '@/lib/analytics/volume-parity';
import { computeKineticImpact } from '@/lib/analytics/kinetic-impact';

/** Local calendar day (`'YYYY-MM-DD'`) `days` days before today. */
export function localDayDaysAgo(days: number, now: Date = new Date()): string {
  const d = new Date(now);
  d.setDate(d.getDate() - days);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/** The active profile's logs of the last `windowDays` local days, oldest first. */
function useProfileLogs(windowDays: number): { logs: WorkoutLog[] | undefined } {
  const { profileId } = useActiveProfile();
  const { data } = useRepoQuery(
    // The repository returns newest first; the analytics helpers read oldest first.
    async (repo) => (profileId ? (await repo.logs.list(profileId, { from: localDayDaysAgo(windowDays) })).reverse() : []),
    [profileId, windowDays],
  );
  return { logs: data };
}

/** Exercise name from the lazy catalog, falling back to the id. */
function useExerciseName(): { lookup: ExerciseLookup | undefined; nameOf: (id: string) => string; catalogLoading: boolean } {
  const { catalog, loading: catalogLoading } = useCatalog();
  const lookup = useMemo<ExerciseLookup | undefined>(() => (catalog ? (id) => catalog.getById(id) : undefined), [catalog]);
  const nameOf = useCallback((id: string) => catalog?.getById(id)?.name ?? id, [catalog]);
  return { lookup, nameOf, catalogLoading };
}

/** Analytics over the active profile's logs (repository) and the lazy catalog. */
export function useAnalyticsData(windowDays = 90) {
  const { logs } = useProfileLogs(windowDays);
  const { lookup, nameOf, catalogLoading } = useExerciseName();

  const acwr = useMemo(() => (logs ? computeACWR(logs) : []), [logs]);
  const weeklyVolume = useMemo(() => (logs ? computeWeeklyVolume(logs) : []), [logs]);
  const muscleGaps = useMemo(() => (logs ? analyzeMuscleGaps(logs) : []), [logs]);
  const bestLifts = useMemo(() => (logs ? getBestLifts(logs) : {}), [logs]);
  const muscleVolume = useMemo(() => (logs ? volumeByMuscle(logs) : {}), [logs]);
  // Pattern-based scores need exercise metadata: wait for the catalog.
  const volumeParity = useMemo(() => (logs && lookup ? computeVolumeParity(logs, 30, { lookup }) : []), [logs, lookup]);
  const kineticImpact = useMemo(
    () => (logs && lookup ? computeKineticImpact(logs, 28, { lookup }) : null),
    [logs, lookup],
  );

  return {
    logs: logs ?? [],
    acwr,
    weeklyVolume,
    muscleGaps,
    bestLifts,
    muscleVolume,
    volumeParity,
    kineticImpact,
    nameOf,
    // A catalog that failed to load leaves the pattern-based cards empty instead of spinning.
    isLoading: logs === undefined || catalogLoading,
  };
}

/** e1RM history of one exercise over the active profile's whole history. */
export function useExerciseAnalyticsData(exerciseId: string) {
  const { profileId } = useActiveProfile();
  const { data: logs } = useRepoQuery(
    async (repo) => (profileId ? (await repo.logs.historyFor(profileId, exerciseId)).reverse() : []),
    [profileId, exerciseId],
  );
  const { nameOf } = useExerciseName();
  const e1rmProgression = useMemo(() => (logs ? getE1RMProgression(logs, exerciseId) : []), [logs, exerciseId]);
  return { e1rmProgression, exerciseName: nameOf(exerciseId), isLoading: logs === undefined };
}
