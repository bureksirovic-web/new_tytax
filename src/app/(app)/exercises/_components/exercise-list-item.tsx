'use client';
import Link from 'next/link';
import type { Exercise } from '@/contracts/domain';
import { Badge } from '@/components/ui/badge';
import { useT } from '@/lib/i18n/use-t';
import { FavouriteButton } from './favourite-button';
import { impactMuscleKey, labelOr, modalityKey, muscleGroupKey } from './labels';

interface ExerciseListItemProps {
  exercise: Exercise;
  favourite: boolean;
  favouriteDisabled: boolean;
  onToggleFavourite: (exerciseId: string) => Promise<boolean>;
  /** Current library query, carried along so the detail's back link restores it. */
  backQuery: string;
}

export function ExerciseListItem({ exercise, favourite, favouriteDisabled, onToggleFavourite, backQuery }: ExerciseListItemProps) {
  const { t } = useT();
  const top = [...exercise.impact].sort((a, b) => b.score - a.score).slice(0, 3);
  const href = backQuery
    ? `/exercises/${encodeURIComponent(exercise.id)}?from=${encodeURIComponent(backQuery)}`
    : `/exercises/${encodeURIComponent(exercise.id)}`;

  return (
    <li className="flex items-stretch gap-1 rounded-xl border border-line bg-card transition-colors hover:bg-card-hover">
      <Link
        href={href}
        data-testid={`exercise-row-${exercise.id}`}
        className="flex min-h-[72px] min-w-0 flex-1 flex-col justify-center gap-1 rounded-xl px-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tactical-amber-400"
      >
        <span className="truncate text-sm font-semibold text-fg">{exercise.name}</span>
        <span className="flex flex-wrap items-center gap-1.5 text-xs text-fg-muted">
          <Badge variant={exercise.modality}>{t(modalityKey(exercise.modality))}</Badge>
          <span>{t(muscleGroupKey(exercise.muscleGroup))}</span>
          {exercise.isUnilateral && <Badge>{t('ex_unilateral')}</Badge>}
        </span>
        {top.length > 0 && (
          <span className="truncate text-xs text-fg-2">
            {top.map((m) => labelOr(t, impactMuscleKey(m.muscle), m.muscle)).join(' · ')}
          </span>
        )}
      </Link>
      <div className="flex items-center pr-2">
        <FavouriteButton
          exerciseId={exercise.id}
          name={exercise.name}
          active={favourite}
          disabled={favouriteDisabled}
          onToggle={onToggleFavourite}
        />
      </div>
    </li>
  );
}
