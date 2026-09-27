'use client';
import { useState } from 'react';
import type { SessionExercise } from '@/contracts/domain';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useSetsStrings } from './strings/sets';
import { CloseIcon } from './icons';
import '@/lib/i18n/packs/g3Workout';

export interface ExerciseRemoveButtonProps {
  exercise: SessionExercise;
  className: string;
  onRemove: () => void;
}

/** Removes an exercise at once; one with a done set (logged work) asks first. */
export function ExerciseRemoveButton({ exercise, className, onRemove }: ExerciseRemoveButtonProps) {
  const t = useSetsStrings();
  const [confirming, setConfirming] = useState(false);
  const name = exercise.exerciseName;

  return (
    <>
      <button
        type="button"
        data-testid="remove-exercise"
        aria-label={`${name}: ${t('card_remove')}`}
        onClick={() => (exercise.sets.some((s) => s.done) ? setConfirming(true) : onRemove())}
        className={className}
      >
        <CloseIcon />
      </button>
      <ConfirmDialog
        open={confirming}
        title={t('card_remove_title')}
        message={t('card_remove_message', { name })}
        confirmLabel={t('card_remove_confirm')}
        cancelLabel={t('set_remove_cancel')}
        danger
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          setConfirming(false);
          onRemove();
        }}
      />
    </>
  );
}
