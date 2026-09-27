'use client';
import { useSetsStrings } from './strings/sets';
import { FlameIcon, PlusIcon } from './icons';
import '@/lib/i18n/packs/g3Workout';

export interface ExerciseCardFooterProps {
  exerciseName: string;
  onAddSet: () => void;
  onAddWarmup: () => void;
  /** False when there is no working weight yet or warm-ups already exist. */
  canAddWarmup: boolean;
}

const footerButton =
  'flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg border border-dashed border-[var(--border-color)] text-sm uppercase tracking-wider text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--highlight)]';

export function ExerciseCardFooter({ exerciseName, onAddSet, onAddWarmup, canAddWarmup }: ExerciseCardFooterProps) {
  const t = useSetsStrings();
  return (
    <div className="mt-2 flex gap-2">
      <button
        type="button"
        data-testid="add-warmup"
        aria-label={`${exerciseName}: ${t('card_add_warmup')}`}
        disabled={!canAddWarmup}
        onClick={onAddWarmup}
        className={footerButton}
      >
        <FlameIcon className="h-4 w-4" />
        {t('card_add_warmup')}
      </button>
      <button
        type="button"
        data-testid="add-set"
        aria-label={`${exerciseName}: ${t('card_add_set')}`}
        onClick={onAddSet}
        className={footerButton}
      >
        <PlusIcon className="h-4 w-4" />
        {t('card_add_set')}
      </button>
    </div>
  );
}
