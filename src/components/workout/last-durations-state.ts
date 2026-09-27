'use client';
import { useEffect, useState } from 'react';

type LoadLastDurations = (exerciseId: string) => Promise<Array<number | undefined>>;

const NONE: Array<number | undefined> = [];

/**
 * Last session's working-set seconds for a time exercise, through
 * `useWorkout().lastDurations` (passed in so a card keeps a single
 * useWorkout()). Empty while loading, for a reps exercise (`enabled` false),
 * without a loader, or when loading failed.
 */
export function useLastDurations(
  load: LoadLastDurations | undefined,
  exerciseId: string,
  enabled: boolean,
): Array<number | undefined> {
  const [state, setState] = useState<{ key: string; values: Array<number | undefined> }>({ key: '', values: NONE });
  const key = enabled && load ? exerciseId : '';

  useEffect(() => {
    if (!enabled || !load) return;
    let live = true;
    load(exerciseId).then(
      (values) => {
        if (live) setState({ key: exerciseId, values });
      },
      () => {
        if (live) setState({ key: exerciseId, values: NONE });
      },
    );
    return () => {
      live = false;
    };
  }, [load, exerciseId, enabled]);

  return key !== '' && state.key === key ? state.values : NONE;
}
