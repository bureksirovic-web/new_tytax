'use client';
import { useMemo } from 'react';
import { snapshotNameOf } from '@/components/analytics/pinned-names';
import { usePinnedExercises } from '@/components/analytics/pinned-storage';
import { useCatalog } from '@/hooks/use-exercises';
import { useRepoQuery } from '@/hooks/use-repo';
import { latestBestE1rm, type LatestBest } from './pinned-math';

/** How many of an exercise's newest logs are searched for a rankable set. */
export const PINNED_HISTORY_LIMIT = 20;

export interface PinnedLift {
  exerciseId: string;
  /** Catalog name, else a log's name snapshot (soft-deleted logs too); null → show "removed". Never the raw id. */
  name: string | null;
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
      profileId
        ? Promise.all(
            pins.map(async (id) => {
              const live = await repo.logs.historyFor(profileId, id, { limit: PINNED_HISTORY_LIMIT });
              const named = snapshotNameOf(live, id)
                ?? snapshotNameOf(await repo.logs.historyFor(profileId, id, { includeDeleted: true, limit: 1 }), id);
              return { live, named };
            }),
          )
        : [],
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
        name: exercise?.name ?? histories[i]?.named ?? null,
        latest: timed ? null : latestBestE1rm(histories[i]?.live ?? [], exerciseId),
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` is `pins` by value
  }, [histories, key, catalog]);

  return { lifts, loading: historyQ.loading, failed: historyQ.error !== undefined };
}
