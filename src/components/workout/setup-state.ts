'use client';
import { useCallback, useEffect, useState } from 'react';
import type { MachineSetup } from '@/contracts/domain';
import type { WorkoutSetupApi } from '@/hooks/use-workout';
import type { SaveSetupResult } from '@/stores/setup-adapter';

export interface ExerciseSetupState {
  /** The profile's stored setup; undefined while loading, when none, or when loading failed. */
  setup: MachineSetup | undefined;
  /** False: the repository cannot store a setup yet (show it read-only). */
  canSave: boolean;
  save(setup: MachineSetup | undefined): Promise<SaveSetupResult>;
}

/**
 * Machine setup of one exercise for the active profile, through
 * `useWorkout().setup` (passed in so a card keeps a single useWorkout()).
 * A successful save replaces the shown setup with the stored (cleaned) one.
 */
export function useExerciseSetup(api: WorkoutSetupApi, exerciseId: string): ExerciseSetupState {
  const [setup, setSetup] = useState<MachineSetup | undefined>(undefined);

  useEffect(() => {
    let live = true;
    api.load(exerciseId).then(
      (value) => {
        if (live) setSetup(value);
      },
      () => {
        if (live) setSetup(undefined);
      },
    );
    return () => {
      live = false;
    };
  }, [api, exerciseId]);

  const save = useCallback(
    async (value: MachineSetup | undefined) => {
      const result = await api.save(exerciseId, value);
      if (result.saved) setSetup(result.setup);
      return result;
    },
    [api, exerciseId],
  );

  return { setup, canSave: api.canSave, save };
}
