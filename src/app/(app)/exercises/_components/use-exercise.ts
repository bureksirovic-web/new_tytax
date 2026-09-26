'use client';
import { useEffect, useState } from 'react';
import type { Exercise } from '@/contracts/domain';
import { catalog } from '@/lib/catalog';

export type ExerciseLookup =
  | { status: 'loading' }
  | { status: 'ready'; exercise: Exercise }
  | { status: 'missing' }
  | { status: 'error'; retry: () => void };

interface State {
  key: string;
  exercise?: Exercise;
  failed?: boolean;
}

/** One exercise from the lazy catalog (loads only its chunk). Unknown id → 'missing'. */
export function useExercise(id: string): ExerciseLookup {
  const [attempt, setAttempt] = useState(0);
  const key = `${id}#${attempt}`;
  const [state, setState] = useState<State>({ key: '' });

  useEffect(() => {
    let cancelled = false;
    catalog.getById(id).then(
      (exercise) => {
        if (!cancelled) setState({ key, exercise });
      },
      () => {
        if (!cancelled) setState({ key, failed: true });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [id, key]);

  if (state.key !== key) return { status: 'loading' };
  if (state.failed) return { status: 'error', retry: () => setAttempt((n) => n + 1) };
  return state.exercise ? { status: 'ready', exercise: state.exercise } : { status: 'missing' };
}
