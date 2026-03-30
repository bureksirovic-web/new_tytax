'use client';
import { useState, useMemo } from 'react';
import { TYTAX_EXERCISES } from '@/data/tytax/exercises';
import { BODYWEIGHT_EXERCISES } from '@/data/bodyweight/exercises';
import { KB_EXERCISES } from '@/data/kettlebell/exercises';
import type { Exercise, Modality } from '@/types/exercise';

export type ExerciseFilter = {
  query: string;
  modality: 'all' | Modality;
  muscle: string;
};

const DEFAULT_FILTER: ExerciseFilter = {
  query: '',
  modality: 'all',
  muscle: '',
};

const ALL_EXERCISES: Exercise[] = [
  ...TYTAX_EXERCISES,
  ...BODYWEIGHT_EXERCISES,
  ...KB_EXERCISES,
];

export function useExercises(initialFilter?: Partial<ExerciseFilter>) {
  const [filter, setFilter] = useState<ExerciseFilter>({
    ...DEFAULT_FILTER,
    ...initialFilter,
  });

  const exercises = useMemo<Exercise[]>(() => {
    let result = ALL_EXERCISES;

    if (filter.modality !== 'all') {
      result = result.filter((e) => e.modality === filter.modality);
    }

    if (filter.muscle) {
      const muscleLower = filter.muscle.toLowerCase();
      result = result.filter(
        (e) =>
          e.impact.some((i) => i.muscle.toLowerCase().includes(muscleLower)) ||
          e.muscleGroup.toLowerCase().includes(muscleLower)
      );
    }

    if (filter.query.trim()) {
      const q = filter.query.trim().toLowerCase();
      result = result.filter(
        (e) =>
          e.name.toLowerCase().includes(q) ||
          e.muscleGroup.toLowerCase().includes(q) ||
          e.pattern?.toLowerCase().includes(q) ||
          e.searchTerms?.some((t) => t.toLowerCase().includes(q)) ||
          e.tags?.some((t) => t.toLowerCase().includes(q))
      );
    }

    return result;
  }, [filter]);

  return {
    exercises,
    filter,
    setFilter,
    totalCount: ALL_EXERCISES.length,
  };
}
