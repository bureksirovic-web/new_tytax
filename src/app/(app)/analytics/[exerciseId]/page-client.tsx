'use client';
import Link from 'next/link';
import { use } from 'react';
import { ExerciseProgress } from '@/components/analytics/exercise-progress';
import { useExerciseHistory, useExerciseNames } from '@/components/analytics/use-analytics-data';
import { Card, Skeleton } from '@/components/ui';
import { useT } from '@/lib/i18n/use-t';

interface Props {
  params: Promise<{ exerciseId: string }>;
}

const BACK =
  'inline-flex min-h-11 items-center rounded-lg px-2 text-sm text-fg-2 hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tactical-amber-400';

function safeDecode(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export default function ExerciseAnalyticsPage({ params }: Props) {
  const { exerciseId: raw } = use(params);
  const exerciseId = safeDecode(raw);
  const { t } = useT();
  const { logs, units, loading } = useExerciseHistory(exerciseId);
  const { nameOf, catalogLoading, isUnknown } = useExerciseNames();
  const snapshot = logs.flatMap((l) => l.exercises).find((e) => e.exerciseId === exerciseId)?.exerciseName;
  // Not found = no catalog entry and no history in this profile (custom exercises live only in history).
  const notFound = !loading && !catalogLoading && isUnknown(exerciseId) && logs.length === 0;

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4">
      <Link href="/analytics" className={BACK}>
        <span aria-hidden="true">←</span>&nbsp;{t('ana_back')}
      </Link>
      {loading || catalogLoading ? (
        <div className="space-y-4" role="status" aria-label={t('ana_loading')}>
          <Skeleton className="h-10 w-48 rounded" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
      ) : notFound ? (
        <>
          <h1 data-testid="page-heading-analytics-exercise" className="font-display text-xl font-bold uppercase tracking-wider text-fg">
            {t('ana_exercise_not_found')}
          </h1>
          <p className="text-sm text-fg-2" role="status" data-testid="ana-exercise-not-found">
            {t('ana_exercise_not_found_desc')}
          </p>
        </>
      ) : (
        <>
          <h1 data-testid="page-heading-analytics-exercise" className="font-display text-xl font-bold uppercase tracking-wider text-fg">
            {nameOf(exerciseId, snapshot)}
          </h1>
          <Card>
            <ExerciseProgress logs={logs} exerciseId={exerciseId} units={units} headingLevel="h2" />
          </Card>
          {!isUnknown(exerciseId) && (
            <Link href={`/exercises/${encodeURIComponent(exerciseId)}`} className={BACK}>
              {t('ana_view_exercise')}
            </Link>
          )}
        </>
      )}
    </div>
  );
}
