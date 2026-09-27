'use client';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AddToWorkoutButton } from '@/components/workout/add-to-workout-button';
import { useActiveProfile } from '@/hooks/use-repo';
import { useT } from '@/lib/i18n/use-t';
import { ExerciseExtras } from './exercise-extras';
import { ExerciseHeader } from './exercise-header';
import { ExerciseHistory } from './exercise-history';
import { ExerciseNotes } from './exercise-notes';
import { ImpactList } from './impact-list';
import { MachineSetupEditor } from './machine-setup';
import { parseLibraryParams, serializeLibraryParams } from './library-params';
import { useArsenal } from './use-arsenal';
import { useExercise } from './use-exercise';
import { VideoList } from './video-list';

const backCls =
  'inline-flex min-h-11 items-center gap-1 self-start rounded-lg text-sm text-fg-muted hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tactical-amber-400';

/** Back target: the library with the filters the user came from (re-validated). */
export function backHref(from: string | null | undefined): string {
  const qs = from ? serializeLibraryParams(parseLibraryParams(new URLSearchParams(from))) : '';
  return qs ? `/exercises?${qs}` : '/exercises';
}

/** /exercises/[id]: everything about one exercise for the active profile. */
export function ExerciseDetail({ id, from }: { id: string; from?: string | null }) {
  const { t } = useT();
  const lookup = useExercise(id);
  const { profile, profileId, loading: profileLoading } = useActiveProfile();
  const arsenal = useArsenal();
  const units = profile?.settings.units ?? 'kg';
  const back = (
    <Link href={backHref(from)} className={backCls}>
      <span aria-hidden="true">←</span> {t('ex_detail_back')}
    </Link>
  );

  if (lookup.status === 'loading') {
    return (
      <div className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-6" aria-busy="true">
        <span role="status" className="sr-only">{t('ex_detail_loading')}</span>
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
    );
  }

  if (lookup.status !== 'ready') {
    return (
      <div className="mx-auto flex max-w-2xl flex-col items-center gap-4 px-4 py-16 text-center" data-testid="exercise-not-found">
        <h1 data-testid="page-heading-exercise-detail" className="font-display text-xl font-semibold text-fg-2">
          {lookup.status === 'missing' ? t('ex_detail_not_found') : t('ex_load_error')}
        </h1>
        {lookup.status === 'missing' ? (
          <p className="text-sm text-fg-muted">{t('ex_detail_not_found_desc')}</p>
        ) : (
          <Button variant="secondary" onClick={lookup.retry}>{t('ex_retry')}</Button>
        )}
        {back}
      </div>
    );
  }

  const exercise = lookup.exercise;
  return (
    <article className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-6 pb-24">
      {back}
      <ExerciseHeader
        exercise={exercise}
        favourite={arsenal.ids?.has(exercise.id) ?? false}
        favouriteDisabled={!arsenal.ids || !arsenal.profileId}
        onToggleFavourite={arsenal.toggle}
      />
      <AddToWorkoutButton exercise={exercise} />
      <VideoList exercise={exercise} />
      <ImpactList impact={exercise.impact} />
      <ExerciseHistory
        exerciseId={exercise.id}
        profileId={profileId}
        units={units}
        profileLoading={profileLoading}
        measure={exercise.measure}
      />
      <ExerciseExtras exercise={exercise} units={units} />
      {(exercise.modality === 'tytax' || exercise.modality === 'custom') && (
        <MachineSetupEditor exerciseId={exercise.id} exerciseName={exercise.name} profileId={profileId} />
      )}
      <ExerciseNotes exerciseId={exercise.id} exerciseName={exercise.name} profileId={profileId} />
    </article>
  );
}
