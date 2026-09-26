'use client';
import type { SessionExercise } from '@/contracts/domain';
import { useLocale } from '@/components/providers';
import { useWorkoutStore } from '@/stores/workout-store';
import { SetRow } from './set-row';
import { ArrowDownIcon, ArrowUpIcon, CloseIcon, PlusIcon } from './icons';

export interface SessionExerciseCardProps {
  exercise: SessionExercise;
  isFirst: boolean;
  isLast: boolean;
}

const iconButton =
  'flex min-h-11 min-w-11 items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--highlight)]';

export function SessionExerciseCard({ exercise, isFirst, isLast }: SessionExerciseCardProps) {
  const { t } = useLocale();
  const moveExercise = useWorkoutStore((s) => s.moveExercise);
  const removeExercise = useWorkoutStore((s) => s.removeExercise);
  const addSet = useWorkoutStore((s) => s.addSet);
  const updateSet = useWorkoutStore((s) => s.updateSet);
  const removeSet = useWorkoutStore((s) => s.removeSet);
  const toggleSetDone = useWorkoutStore((s) => s.toggleSetDone);
  const { uid } = exercise;
  const headingId = `exercise-${uid}`;

  return (
    <section
      data-testid="session-exercise"
      data-exercise-id={exercise.exerciseId}
      data-uid={uid}
      aria-labelledby={headingId}
      className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] p-3"
    >
      <div className="mb-2 flex items-start gap-1">
        <h2
          id={headingId}
          className="flex-1 pt-2.5 font-display text-base font-bold uppercase tracking-wide text-[var(--text-primary)]"
        >
          {exercise.exerciseName}
        </h2>
        <button
          type="button"
          data-testid="move-exercise-up"
          aria-label={`${exercise.exerciseName}: ${t('prev')}`}
          disabled={isFirst}
          onClick={() => moveExercise(uid, -1)}
          className={iconButton}
        >
          <ArrowUpIcon />
        </button>
        <button
          type="button"
          data-testid="move-exercise-down"
          aria-label={`${exercise.exerciseName}: ${t('next')}`}
          disabled={isLast}
          onClick={() => moveExercise(uid, 1)}
          className={iconButton}
        >
          <ArrowDownIcon />
        </button>
        <button
          type="button"
          data-testid="remove-exercise"
          aria-label={`${exercise.exerciseName}: ${t('delete')}`}
          onClick={() => removeExercise(uid)}
          className={iconButton}
        >
          <CloseIcon />
        </button>
      </div>

      <ol className="space-y-1.5">
        {exercise.sets.map((set, i) => (
          <SetRow
            key={set.id}
            set={set}
            index={i + 1}
            onChange={(patch) => updateSet(uid, set.id, patch)}
            onToggleDone={() => toggleSetDone(uid, set.id)}
            onRemove={() => removeSet(uid, set.id)}
          />
        ))}
      </ol>

      <button
        type="button"
        data-testid="add-set"
        onClick={() => addSet(uid)}
        className="mt-2 flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-dashed border-[var(--border-color)] text-sm uppercase tracking-wider text-[var(--text-secondary)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--highlight)]"
      >
        <PlusIcon className="h-4 w-4" />
        {t('workout_add_set')}
      </button>
    </section>
  );
}
