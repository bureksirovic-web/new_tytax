'use client';
/**
 * Active workout page (G3): header with elapsed time, sticky rest timer,
 * exercise cards, exercise picker, finish → /workout/debrief. Keeps the
 * screen awake while mounted. Picked exercises go through
 * `useWorkout().addExercise` (prefilled from history, warm-ups included).
 */
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Exercise } from '@/contracts/domain';
import { useLocale } from '@/components/providers';
import { Button } from '@/components/ui/button';
import { DiscardWorkoutButton } from '@/components/workout/discard-workout-button';
import { ExercisePicker } from '@/components/workout/exercise-picker';
import { ForeignDraftScreen } from '@/components/workout/foreign-draft';
import { RestTimerBar } from '@/components/workout/rest-timer-bar';
import { SessionExerciseCard } from '@/components/workout/session-exercise-card';
import { PlusIcon } from '@/components/workout/icons';
import { useWakeLock } from '@/components/workout/runtime/use-wake-lock';
import { useWorkout } from '@/hooks/use-workout';
import { isForeignDraft } from '@/stores/workout-orchestrator';
import { useWorkoutHydrated, useWorkoutStore } from '@/stores/workout-store';
import { WorkoutElapsed } from './workout-elapsed';

/**
 * Adds a picked exercise prefilled from history. A null result is a refusal
 * (draft of another profile, or no active profile) and adds nothing. Only a
 * failed prefill falls back to the plain store action, and only for a draft of
 * `profileId`, so a pick is never lost but never lands in another profile's draft.
 */
export async function addPicked(
  exercise: Exercise,
  addPrefilled: (ex: Exercise) => Promise<string | null>,
  profileId: string | undefined,
): Promise<string | null> {
  try {
    return await addPrefilled(exercise);
  } catch {
    const store = useWorkoutStore.getState();
    return store.draft && !isForeignDraft(store.draft, profileId) ? store.addExercise(exercise) : null;
  }
}

export default function ActiveWorkoutPage() {
  const router = useRouter();
  const { t } = useLocale();
  const hydrated = useWorkoutHydrated();
  const draft = useWorkoutStore((s) => s.draft);
  const workout = useWorkout();
  const { settings, addExercise, profileId } = workout;
  const [pickerOpen, setPickerOpen] = useState(false);
  useWakeLock(true);

  // Only a hydrated store can say "no draft"; before that null means nothing.
  useEffect(() => {
    if (hydrated && !draft) router.replace('/workout');
  }, [hydrated, draft, router]);

  const closePicker = useCallback(() => setPickerOpen(false), []);
  const pick = useCallback(
    (exercise: Exercise) => {
      setPickerOpen(false);
      void addPicked(exercise, addExercise, profileId);
    },
    [addExercise, profileId],
  );

  // Until the active profile is known a draft cannot be told apart from another profile's.
  if (!hydrated || !draft || !workout.ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg-primary)] p-4" aria-busy="true">
        <p data-testid="active-workout-loading" className="text-sm text-[var(--text-muted)]">
          {t('loading')}
        </p>
      </div>
    );
  }

  // Another profile's draft (after a profile switch) is never edited as this one.
  if (workout.foreignDraft) return <ForeignDraftScreen workout={workout} />;

  const count = draft.exercises.length;

  return (
    <div data-testid="active-workout" className="min-h-screen bg-[var(--bg-primary)] p-4 pb-32">
      <RestTimerBar voiceCues={settings.voiceCues} />

      <header className="mb-4 flex items-end justify-between gap-3 pt-2">
        <div className="min-w-0">
          <p className="mb-1 text-xs uppercase tracking-widest text-[var(--text-muted)]">{t('workout_active_label')}</p>
          <h1 className="truncate font-display text-2xl font-bold uppercase tracking-wide text-[var(--highlight)]">
            {draft.sessionName}
          </h1>
        </div>
        <WorkoutElapsed startedAt={draft.startedAt} />
      </header>

      {count === 0 ? (
        <div className="mb-4 rounded-xl border border-dashed border-[var(--border-color)] p-6 text-center">
          <p className="font-display text-lg font-bold uppercase tracking-wider text-[var(--text-primary)]">
            {t('workout_first_exercise_title')}
          </p>
        </div>
      ) : (
        <div className="mb-4 space-y-3">
          {draft.exercises.map((ex, i) => (
            <SessionExerciseCard key={ex.uid} exercise={ex} isFirst={i === 0} isLast={i === count - 1} />
          ))}
        </div>
      )}

      <button
        type="button"
        data-testid="add-exercise-button"
        onClick={() => setPickerOpen(true)}
        className="mb-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-dashed border-[var(--border-color)] text-sm uppercase tracking-wider text-[var(--text-secondary)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--highlight)]"
      >
        <PlusIcon className="h-4 w-4" />
        {t('add_exercise')}
      </button>

      <Button
        data-testid="finish-workout"
        size="lg"
        fullWidth
        onClick={() => router.push('/workout/debrief')}
        className="font-bold uppercase tracking-widest"
      >
        {t('workout_finish')}
      </Button>
      <div className="mt-3">
        <DiscardWorkoutButton variant="ghost" sessionName={draft.sessionName} onDiscard={() => useWorkoutStore.getState().discard()} />
      </div>

      {pickerOpen && <ExercisePicker onPick={pick} onClose={closePicker} />}
    </div>
  );
}
