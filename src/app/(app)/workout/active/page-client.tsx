'use client';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Exercise } from '@/contracts/domain';
import { useLocale } from '@/components/providers';
import { Button } from '@/components/ui/button';
import { ExercisePicker } from '@/components/workout/exercise-picker';
import { SessionExerciseCard } from '@/components/workout/session-exercise-card';
import { PlusIcon } from '@/components/workout/icons';
import { useWorkoutHydrated, useWorkoutStore } from '@/stores/workout-store';

export default function ActiveWorkoutPage() {
  const router = useRouter();
  const { t } = useLocale();
  const hydrated = useWorkoutHydrated();
  const draft = useWorkoutStore((s) => s.draft);
  const addExercise = useWorkoutStore((s) => s.addExercise);
  const [pickerOpen, setPickerOpen] = useState(false);

  // Only a hydrated store can say "no draft"; before that null means nothing.
  useEffect(() => {
    if (hydrated && !draft) router.replace('/workout');
  }, [hydrated, draft, router]);

  const closePicker = useCallback(() => setPickerOpen(false), []);
  const pick = useCallback(
    (exercise: Exercise) => {
      addExercise(exercise);
      setPickerOpen(false);
    },
    [addExercise],
  );

  if (!hydrated || !draft) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg-primary)] p-4" aria-busy="true">
        <p data-testid="active-workout-loading" className="text-sm text-[var(--text-muted)]">
          {t('loading')}
        </p>
      </div>
    );
  }

  const count = draft.exercises.length;

  return (
    <div data-testid="active-workout" className="min-h-screen bg-[var(--bg-primary)] p-4 pb-32">
      <header className="mb-4 pt-2">
        <p className="mb-1 text-xs uppercase tracking-widest text-[var(--text-muted)]">{t('workout_active_label')}</p>
        <h1 className="font-display text-2xl font-bold uppercase tracking-wide text-[var(--highlight)]">
          {draft.sessionName}
        </h1>
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

      {pickerOpen && <ExercisePicker onPick={pick} onClose={closePicker} />}
    </div>
  );
}
