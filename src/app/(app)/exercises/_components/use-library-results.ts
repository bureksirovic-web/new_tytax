'use client';
import { useEffect, useMemo, useState } from 'react';
import type { Exercise } from '@/contracts/domain';
import { catalog } from '@/lib/catalog';
import { toCatalogQuery, type LibraryFilter } from './library-params';

interface SearchState {
  key: string;
  list?: Exercise[];
  error?: unknown;
}

export interface LibraryResults {
  /** Filtered, sorted results; the previous results while a new search runs. */
  exercises: Exercise[] | undefined;
  loading: boolean;
  error: unknown;
  retry: () => void;
}

const collators = new Map<string, Intl.Collator>();
function collator(locale: string): Intl.Collator {
  let c = collators.get(locale);
  if (!c) {
    c = new Intl.Collator(locale, { sensitivity: 'base', numeric: true });
    collators.set(locale, c);
  }
  return c;
}

/**
 * Runs `catalog.search` (diacritic-insensitive text + modality/muscle group/
 * station/attachment) and, on the Arsenal tab, keeps only favourites.
 */
export function useLibraryResults(filter: LibraryFilter, favoriteIds: ReadonlySet<string> | undefined, locale: string): LibraryResults {
  const [attempt, setAttempt] = useState(0);
  const { text, modality, muscleGroup, stationId, attachmentId } = toCatalogQuery(filter);
  const key = JSON.stringify([text, modality, muscleGroup, stationId, attachmentId, attempt]);
  const [state, setState] = useState<SearchState>({ key: '' });

  useEffect(() => {
    let cancelled = false;
    catalog.search({ text, modality, muscleGroup, stationId, attachmentId }).then(
      (list) => {
        if (!cancelled) setState({ key, list });
      },
      (error: unknown) => {
        if (!cancelled) setState({ key, error: error ?? new Error('search failed') });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [key, text, modality, muscleGroup, stationId, attachmentId]);

  const current = state.key === key;
  const list = state.list;
  const exercises = useMemo(() => {
    if (!list) return undefined;
    if (filter.favorites && !favoriteIds) return undefined;
    const kept = filter.favorites && favoriteIds ? list.filter((e) => favoriteIds.has(e.id)) : [...list];
    const c = collator(locale);
    return kept.sort((a, b) => c.compare(a.name, b.name));
  }, [list, filter.favorites, favoriteIds, locale]);

  return {
    exercises,
    loading: !current || exercises === undefined,
    error: current ? state.error : undefined,
    retry: () => setAttempt((n) => n + 1),
  };
}
