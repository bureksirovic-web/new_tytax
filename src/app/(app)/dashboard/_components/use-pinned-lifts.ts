'use client';
import { useMemo } from 'react';
import { usePinnedExercises } from '@/components/analytics/pinned-storage';
import { useCatalog } from '@/hooks/use-exercises';
import { useRepoQuery } from '@/hooks/use-repo';
import { latestBestE1rm, type LatestBest } from './pinned-math';

/** How many of an exercise's newest logs are searched for a rankable set. */
export const PINNED_HISTORY_LIMIT = 20;

export interface PinnedLift {
  exerciseId: string;
  name: string;
  /** Null when there is no rankable set yet (or the exercise is time-measured). */
  latest: LatestBest | null;
}

export interface PinnedLifts {
  lifts: PinnedLift[];
  loading: boolean;
  failed: boolean;
}

/** The active profile's pinned exercises with the best e1RM of their latest session. */
export function usePinnedLifts(): PinnedLifts {
  const { pins, profileId } = usePinnedExercises();
  const key = pins.join('\n');
  const historyQ = useRepoQuery(
    async (repo) =>
      profileId ? Promise.all(pins.map((id) => repo.logs.historyFor(profileId, id, { limit: PINNED_HISTORY_LIMIT }))) : [],
    // `key` stands in for `pins` by value.
    [profileId, key],
  );
  const { catalog } = useCatalog();
  const histories = historyQ.data;

  const lifts = useMemo(() => {
    if (!histories) return [];
    return pins.map((exerciseId, i) => {
      const exercise = catalog?.getById(exerciseId);
      const timed = exercise?.measure === 'time';
      return {
        exerciseId,
        name: exercise?.name ?? exerciseId,
        latest: timed ? null : latestBestE1rm(histories[i] ?? [], exerciseId),
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` is `pins` by value
  }, [histories, key, catalog]);

  return { lifts, loading: historyQ.loading, failed: historyQ.error !== undefined };
}
