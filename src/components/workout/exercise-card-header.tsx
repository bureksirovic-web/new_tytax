'use client';
import type { Exercise, SessionExercise } from '@/contracts/domain';
import { useSetsStrings } from './strings/sets';
import { VideoButton } from './video-button';
import { ExerciseRemoveButton } from './exercise-remove-button';
import { ArrowDownIcon, ArrowUpIcon, SwapIcon } from './icons';

export interface ExerciseCardHeaderProps {
  exercise: SessionExercise;
  /** Catalog entry (videos); undefined while loading or for unknown ids. */
  catalogExercise?: Exercise;
  headingId: string;
  isFirst: boolean;
  isLast: boolean;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
  onSwap: () => void;
}

export const cardIconButton =
  'flex min-h-11 min-w-11 items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--highlight)]';

export function ExerciseCardHeader({
  exercise,
  catalogExercise,
  headingId,
  isFirst,
  isLast,
  onMove,
  onRemove,
  onSwap,
}: ExerciseCardHeaderProps) {
  const t = useSetsStrings();
  const name = exercise.exerciseName;

  return (
    <div className="mb-2 flex flex-wrap items-start gap-1">
      <h2
        id={headingId}
        data-testid="exercise-name"
        className="min-w-0 flex-1 basis-40 pt-2.5 font-display text-base font-bold uppercase tracking-wide text-[var(--text-primary)]"
      >
        {name}
      </h2>
      <div className="flex items-center">
        <VideoButton name={name} exercise={catalogExercise} />
        <button
          type="button"
          data-testid="swap-exercise"
          aria-label={`${name}: ${t('card_swap')}`}
          aria-haspopup="dialog"
          onClick={onSwap}
          className={cardIconButton}
        >
          <SwapIcon />
        </button>
        <button
          type="button"
          data-testid="move-exercise-up"
          aria-label={`${name}: ${t('card_move_up')}`}
          disabled={isFirst}
          onClick={() => onMove(-1)}
          className={cardIconButton}
        >
          <ArrowUpIcon />
        </button>
        <button
          type="button"
          data-testid="move-exercise-down"
          aria-label={`${name}: ${t('card_move_down')}`}
          disabled={isLast}
          onClick={() => onMove(1)}
          className={cardIconButton}
        >
          <ArrowDownIcon />
        </button>
        <ExerciseRemoveButton exercise={exercise} className={cardIconButton} onRemove={onRemove} />
      </div>
    </div>
  );
}
