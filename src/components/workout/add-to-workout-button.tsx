'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Exercise } from '@/contracts/domain';
import { getRepository } from '@/lib/db';
import { useActiveProfile } from '@/hooks/use-repo';
import { useLocale } from '@/components/providers';
import { Button } from '@/components/ui/button';
import { useWorkoutHydrated, useWorkoutStore } from '@/stores/workout-store';

/**
 * Adds the exercise to the current workout, starting a quick workout first
 * when there is none, then opens the active workout. Disabled until the
 * persisted draft is hydrated, so it can never overwrite a draft it has not
 * read yet.
 */
export function AddToWorkoutButton({ exercise }: { exercise: Exercise }) {
  const router = useRouter();
  const { t } = useLocale();
  const hydrated = useWorkoutHydrated();
  const { profileId, loading } = useActiveProfile();
  const [busy, setBusy] = useState(false);

  async function add() {
    setBusy(true);
    try {
      if (!useWorkoutStore.getState().draft) {
        const pid = profileId ?? (await getRepository().profiles.ensureActive(t('profile'))).id;
        // i18n: `workout_quick_session_name` requested in docs/v2/requests/G1-i18n.md.
        useWorkoutStore.getState().startQuick(pid, t('nav_workout'));
      }
      useWorkoutStore.getState().addExercise(exercise);
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
      disabled={!hydrated || loading || busy}
      onClick={() => void add()}
    >
      {t('workout_add_to_workout')}
    </Button>
  );
}
