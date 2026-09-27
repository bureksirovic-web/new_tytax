'use client';

import { useState } from 'react';
import type { WorkoutLog } from '@/contracts/domain';
import { useActiveProfile, useRepoQuery } from './use-repo';

interface HistoryPage {
  logs: WorkoutLog[];
  total: number;
}

const EMPTY: HistoryPage = { logs: [], total: 0 };

/** The page index and the profile it belongs to: any profile switch restarts at page 0. */
interface PageCursor {
  profileId: string | undefined;
  page: number;
}

/** Index of the last page that holds a log (0 when there are none). */
function lastPageFor(total: number, pageSize: number): number {
  return Math.max(0, Math.ceil(total / pageSize) - 1);
}

/**
 * The active profile's finished workouts, newest first, one page at a time.
 * Live (re-renders on finish/edit/delete and on profile switch); soft-deleted
 * logs are hidden and never counted in `total`. Every profile switch starts at
 * page 0, and when deletions empty the current page it moves back to the last
 * page that still holds logs.
 */
export function useHistory(pageSize = 20) {
  const { profileId, loading: profileLoading, error: profileError } = useActiveProfile();
  const [cursor, setCursor] = useState<PageCursor>({ profileId: undefined, page: 0 });
  // Adjusting state during render (React's documented pattern): a new profile resets the page.
  if (cursor.profileId !== profileId) setCursor({ profileId, page: 0 });
  const page = cursor.profileId === profileId ? cursor.page : 0;

  const { data, error } = useRepoQuery<HistoryPage>(
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

  // Deletions can leave the current page past the end: step back to the last non-empty page.
  if (data !== undefined && page > lastPageFor(data.total, pageSize)) {
    setCursor({ profileId, page: lastPageFor(data.total, pageSize) });
  }

  const move = (delta: number) =>
    setCursor((c) => {
      const from = c.profileId === profileId ? c.page : 0;
      return { profileId, page: Math.max(0, from + delta) };
    });

  const total = data?.total ?? 0;
  const failure: unknown = profileError ?? error;
  return {
    logs: data?.logs ?? [],
    total,
    page,
    pageSize,
    hasMore: total > (page + 1) * pageSize,
    nextPage: () => move(1),
    prevPage: () => move(-1),
    isLoading: failure === undefined && (profileLoading || data === undefined),
    /** Set when the query failed; `logs` is then empty. */
    error: failure,
  };
}
