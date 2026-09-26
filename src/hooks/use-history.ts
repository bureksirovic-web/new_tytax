'use client';

import { useState } from 'react';
import type { WorkoutLog } from '@/contracts/domain';
import { useActiveProfile, useRepoQuery } from './use-repo';

interface HistoryPage {
  logs: WorkoutLog[];
  total: number;
}

const EMPTY: HistoryPage = { logs: [], total: 0 };

/** The active profile's finished workouts, newest first, one page at a time (live). */
export function useHistory(pageSize = 20) {
  const [page, setPage] = useState(0);
  const { profileId, loading: profileLoading } = useActiveProfile();

  const { data } = useRepoQuery<HistoryPage>(
    async (repo) => {
      if (!profileId) return EMPTY;
      const [logs, total] = await Promise.all([
        repo.logs.list(profileId, { limit: pageSize, offset: page * pageSize }),
        repo.logs.count(profileId),
      ]);
      return { logs, total };
    },
    [profileId, page, pageSize],
  );

  const total = data?.total ?? 0;
  return {
    logs: data?.logs ?? [],
    total,
    page,
    pageSize,
    hasMore: total > (page + 1) * pageSize,
    nextPage: () => setPage((p) => p + 1),
    prevPage: () => setPage((p) => Math.max(0, p - 1)),
    isLoading: profileLoading || data === undefined,
  };
}
