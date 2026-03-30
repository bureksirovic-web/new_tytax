'use client';
import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { db } from '@/lib/db/dexie';

export function useHistory(pageSize = 20) {
  const [page, setPage] = useState(0);

  const logs = useLiveQuery(
    () =>
      db.workoutLogs
        .orderBy('date')
        .reverse()
        .offset(page * pageSize)
        .limit(pageSize)
        .toArray(),
    [page, pageSize]
  );

  const total = useLiveQuery(() => db.workoutLogs.count(), []);

  return {
    logs: logs ?? [],
    total: total ?? 0,
    page,
    pageSize,
    hasMore: (total ?? 0) > (page + 1) * pageSize,
    nextPage: () => setPage((p) => p + 1),
    prevPage: () => setPage((p) => Math.max(0, p - 1)),
    isLoading: logs === undefined,
  };
}
