'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Exercise } from '@/contracts/domain';
import { CATALOG_CHUNKS, type Catalog, type CatalogChunkId } from '@/contracts/exercise-catalog';
import { loadCatalog } from '@/lib/catalog';
import { matchesText, queryWords } from '@/lib/catalog/query';

export type ExerciseFilter = {
  query: string;
  modality: 'all' | 'tytax' | 'bodyweight' | 'kettlebell';
  muscle: string;
};

const DEFAULT_FILTER: ExerciseFilter = {
  query: '',
  modality: 'all',
  muscle: '',
};

interface CatalogState {
  key: string;
  catalog?: Catalog;
  error?: unknown;
}

export interface UseCatalogResult {
  catalog: Catalog | undefined;
  loading: boolean;
  error: unknown;
}

/** Loads the lazy catalog (memoised across the app). `chunks` default: all. */
export function useCatalog(chunks?: readonly CatalogChunkId[]): UseCatalogResult {
  const key = chunks ? [...chunks].sort().join('+') : '*';
  const [state, setState] = useState<CatalogState>({ key: '#init' });

  useEffect(() => {
    let cancelled = false;
    const parts = key.split('+');
    const wanted = key === '*' ? undefined : CATALOG_CHUNKS.filter((c) => parts.includes(c));
    loadCatalog(wanted).then(
      (catalog) => {
        if (!cancelled) setState({ key, catalog });
      },
      (error: unknown) => {
        if (!cancelled) setState({ key, error: error ?? new Error('catalog load failed') });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [key]);

  const current = state.key === key;
  return {
    catalog: current ? state.catalog : undefined,
    loading: !current,
    error: current ? state.error : undefined,
  };
}

function applyFilter(all: readonly Exercise[], filter: ExerciseFilter): Exercise[] {
  const muscle = filter.muscle.trim().toLowerCase();
  const words = queryWords(filter.query);
  return all.filter((e) => {
    if (filter.modality !== 'all' && e.modality !== filter.modality) return false;
    if (
      muscle &&
      !e.impact.some((i) => i.muscle.toLowerCase().includes(muscle)) &&
      !e.muscleGroup.toLowerCase().includes(muscle)
    ) {
      return false;
    }
    return matchesText(e, words);
  });
}

/** Filterable exercise list over the lazy catalog (all chunks). */
export function useExercises(initialFilter?: Partial<ExerciseFilter>): {
  exercises: Exercise[];
  filter: ExerciseFilter;
  setFilter: (f: Partial<ExerciseFilter>) => void;
  totalCount: number;
  loading: boolean;
  error: unknown;
} {
  const [filter, setFilterState] = useState<ExerciseFilter>(() => ({
    ...DEFAULT_FILTER,
    ...initialFilter,
  }));
  const { catalog, loading, error } = useCatalog();

  const exercises = useMemo<Exercise[]>(
    () => (catalog ? applyFilter(catalog.exercises, filter) : []),
    [catalog, filter],
  );

  const setFilter = useCallback((f: Partial<ExerciseFilter>) => {
    setFilterState((prev) => ({ ...prev, ...f }));
  }, []);

  return {
    exercises,
    filter,
    setFilter,
    totalCount: catalog?.exercises.length ?? 0,
    loading,
    error,
  };
}
