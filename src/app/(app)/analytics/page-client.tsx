'use client';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useCallback, useMemo } from 'react';
import { AcwrCard } from '@/components/analytics/acwr-card';
import { VolumeParityCard } from '@/components/analytics/balance-cards';
import { trainedExercises } from '@/components/analytics/exercise-series';
import { MuscleDistribution } from '@/components/analytics/muscle-distribution';
import { PinnedMetrics } from '@/components/analytics/pinned-metrics';
import { useAnalyticsData } from '@/components/analytics/use-analytics-data';
import { BestLiftsCard, WeeklyVolumeCard } from '@/components/analytics/volume-and-lifts';
import { EmptyState, Skeleton } from '@/components/ui';
import { useT } from '@/lib/i18n/use-t';

// Below the fold: split out of the /analytics first-load chunk (budget 250 kB gzip).
const cardFallback = () => <Skeleton className="h-40 w-full" />;
const BodyweightCard = dynamic(
  () => import('@/components/analytics/bodyweight-card').then((m) => m.BodyweightCard),
  { ssr: false, loading: cardFallback },
);
const ExerciseInspector = dynamic(
  () => import('@/components/analytics/exercise-inspector').then((m) => m.ExerciseInspector),
  { ssr: false, loading: cardFallback },
);
const TrainingHeatmap = dynamic(
  () => import('@/components/analytics/training-heatmap').then((m) => m.TrainingHeatmap),
  { ssr: false, loading: cardFallback },
);

export default function AnalyticsPage() {
  const { t } = useT();
  const router = useRouter();
  const { loading: dataLoading, catalogLoading, profileId, units, logs, lookup, nameOf, now } = useAnalyticsData();
  // Wait for the lazy catalog too: without it every muscle-based card would flash "no data".
  const loading = dataLoading || catalogLoading;
  const inCatalog = useCallback((id: string) => lookup(id) !== undefined, [lookup]);
  const exercises = useMemo(() => trainedExercises(logs, nameOf), [logs, nameOf]);
  const snapshotNames = useMemo(() => {
    const m = new Map<string, string>();
    for (const log of logs) for (const ex of log.exercises) if (!m.has(ex.exerciseId)) m.set(ex.exerciseId, ex.exerciseName);
    return m;
  }, [logs]);

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4">
      <h1 data-testid="page-heading-analytics" className="pt-2 font-display text-2xl font-bold uppercase tracking-wider text-fg">
        {t('ana_title')}
      </h1>
      {loading ? (
        <div className="space-y-4" role="status" aria-label={t('ana_loading')}>
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 w-full rounded-xl" />
          ))}
        </div>
      ) : logs.length === 0 ? (
        <>
          <EmptyState
            title={t('ana_empty')}
            description={t('ana_empty_desc')}
            action={{ label: t('ana_start_workout'), onClick: () => router.push('/workout') }}
          />
          <BodyweightCard key={profileId ?? 'none'} profileId={profileId} units={units} />
        </>
      ) : (
        <>
          <PinnedMetrics logs={logs} exercises={exercises} nameOf={nameOf} units={units} />
          <AcwrCard logs={logs} lookup={lookup} now={now} />
          <MuscleDistribution logs={logs} lookup={lookup} now={now} units={units} />
          <TrainingHeatmap logs={logs} now={now} units={units} />
          <ExerciseInspector logs={logs} exercises={exercises} units={units} inCatalog={inCatalog} />
          <WeeklyVolumeCard logs={logs} units={units} now={now} />
          <BodyweightCard key={profileId ?? 'none'} profileId={profileId} units={units} />
          <BestLiftsCard logs={logs} units={units} nameOf={nameOf} snapshotName={(id) => snapshotNames.get(id)} />
          <VolumeParityCard logs={logs} lookup={lookup} now={now} />
        </>
      )}
    </div>
  );
}
