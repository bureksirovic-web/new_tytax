'use client';
import type { Exercise, SessionExercise } from '@/contracts/domain';
import { useSetsStrings } from './strings/sets';
import { useSetupStrings } from './strings/setup';
import { VideoButton } from './video-button';
import { ExerciseRemoveButton } from './exercise-remove-button';
import { ArrowDownIcon, ArrowUpIcon, SlidersIcon, SwapIcon } from './icons';
import '@/lib/i18n/packs/g3Session';
import '@/lib/i18n/packs/g3Workout';

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
  /** Opens the machine-setup sheet; no button when omitted. */
  onEditSetup?: () => void;
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
  onEditSetup,
}: ExerciseCardHeaderProps) {
  const t = useSetsStrings();
  const s = useSetupStrings();
  const name = exercise.exerciseName;
  const editSetupLabel = `${name}: ${s('setup_edit')}`;

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
        <VideoButton name={name} modality={exercise.modality} exercise={catalogExercise} />
        {onEditSetup && (
          <button
            type="button"
            data-testid="edit-setup"
            aria-label={editSetupLabel}
            aria-haspopup="dialog"
            onClick={onEditSetup}
            className={cardIconButton}
          >
            <SlidersIcon />
          </button>
        )}
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
