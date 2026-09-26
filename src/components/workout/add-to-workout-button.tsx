'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Exercise } from '@/contracts/domain';
import { getRepository } from '@/lib/db';
import { useWorkout } from '@/hooks/use-workout';
import { useLocale } from '@/components/providers';
import { Button } from '@/components/ui/button';
import { useStartStrings } from '@/components/workout/strings/start';
import { useWorkoutStore } from '@/stores/workout-store';

/**
 * Adds the exercise (prefilled from history, warm-ups included) to the current
 * workout, starting a quick workout first when there is none, then opens the
 * active workout. Disabled until the profile and the persisted draft are
 * loaded, so it can never overwrite a draft it has not read yet.
 */
export function AddToWorkoutButton({ exercise }: { exercise: Exercise }) {
  const router = useRouter();
  const locale = useLocale();
  const t = useStartStrings();
  const { ready, profileId, startQuick, addExercise } = useWorkout();
  const [busy, setBusy] = useState(false);

  async function add() {
    if (busy) return;
    setBusy(true);
    try {
      const store = useWorkoutStore.getState();
      if (!profileId) {
        // Fresh device: no profile, so no history to prefill from.
        const pid = (await getRepository().profiles.ensureActive(locale.t('profile'))).id;
        if (!useWorkoutStore.getState().draft) store.startQuick(pid, t('quick_session_name'));
        useWorkoutStore.getState().addExercise(exercise);
      } else {
        if (!useWorkoutStore.getState().draft) startQuick(t('quick_session_name'));
        await addExercise(exercise);
      }
      router.push('/workout/active');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      data-testid="add-to-workout"
      fullWidth
      variant="primary"
      size="lg"
      disabled={!ready || busy}
      loading={busy}
      onClick={() => void add()}
    >
      {locale.t('workout_add_to_workout')}
    </Button>
  );
}
