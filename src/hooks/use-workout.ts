'use client';
import { useCallback } from 'react';
import { useWorkoutStore } from '@/stores/workout-store';

/**
 * Thin abstraction over the workout store.
 * Exposes a stable `finishAndSave` callback that builds the
 * WorkoutLog from in-memory state, persists it to Dexie, and
 * enqueues a sync operation — delegating to the store's
 * `finishWorkout()`.
 */
export function useWorkout() {
  const store = useWorkoutStore();

  const finishAndSave = useCallback(async () => {
    await store.finishWorkout();
  }, [store.finishWorkout]);

  return {
    ...store,
    finishAndSave,
  };
}
