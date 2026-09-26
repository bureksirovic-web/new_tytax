'use client';
import type { Exercise } from '@/contracts/domain';
import { Badge } from '@/components/ui/badge';
import { useT } from '@/lib/i18n/use-t';
import { FavouriteButton } from './favourite-button';
import { attachmentKey, labelOr, modalityKey, muscleGroupKey, stationKey } from './labels';

interface ExerciseHeaderProps {
  exercise: Exercise;
  favourite: boolean;
  favouriteDisabled: boolean;
  onToggleFavourite: (exerciseId: string) => Promise<boolean>;
}

export function ExerciseHeader({ exercise, favourite, favouriteDisabled, onToggleFavourite }: ExerciseHeaderProps) {
  const { t } = useT();
  const station = exercise.stationId
    ? labelOr(t, stationKey(exercise.stationId), exercise.station ?? exercise.stationId)
    : exercise.station;

  return (
    <header className="flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <h1
          data-testid="page-heading-exercise-detail"
          className="font-display text-2xl font-bold uppercase tracking-wide text-highlight"
        >
          {exercise.name}
        </h1>
        <FavouriteButton
          exerciseId={exercise.id}
          name={exercise.name}
          active={favourite}
          disabled={favouriteDisabled}
          onToggle={onToggleFavourite}
        />
      </div>
      <ul className="flex flex-wrap gap-2" data-testid="exercise-badges">
        <li><Badge variant={exercise.modality}>{t(modalityKey(exercise.modality))}</Badge></li>
        <li><Badge>{t(muscleGroupKey(exercise.muscleGroup))}</Badge></li>
        {station && <li><Badge>{station}</Badge></li>}
        {(exercise.attachmentIds ?? []).map((a) => (
          <li key={a}><Badge>{labelOr(t, attachmentKey(a), a)}</Badge></li>
        ))}
        {exercise.isUnilateral && <li><Badge>{t('ex_unilateral')}</Badge></li>}
      </ul>
      <p className="text-sm text-fg-2">
        {t('ex_pattern', { pattern: exercise.pattern })} · {t('ex_default_prescription', { sets: exercise.defaultSets, reps: exercise.defaultReps })}
        {exercise.tempo ? ` · ${t('ex_tempo', { tempo: exercise.tempo })}` : ''}
      </p>
    </header>
  );
}
