'use client';
import { useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { parseLibraryParams, serializeLibraryParams, type LibraryFilter } from './library-params';

/**
 * Library filter state lives in the URL query, so back-navigation from a
 * detail page restores it. Changes replace the current history entry (no
 * history spam per keystroke).
 */
export function useLibraryFilter(): {
  filter: LibraryFilter;
  setFilter: (patch: Partial<LibraryFilter>) => void;
} {
  const params = useSearchParams();
  const router = useRouter();
  const qs = params?.toString() ?? '';
  const filter = useMemo(() => parseLibraryParams(new URLSearchParams(qs)), [qs]);

  const setFilter = useCallback(
    (patch: Partial<LibraryFilter>) => {
      const next = serializeLibraryParams({ ...filter, ...patch });
      if (next === serializeLibraryParams(filter)) return;
      router.replace(next ? `/exercises?${next}` : '/exercises', { scroll: false });
    },
    [filter, router],
  );

  return { filter, setFilter };
}
