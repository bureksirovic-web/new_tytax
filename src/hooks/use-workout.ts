'use client';
import { useWorkoutStore } from '@/stores/workout-store';

export function useWorkout() {
  const store = useWorkoutStore();

  return {
    ...store,
    finishAndSave: store.finishWorkout,
  };
}
