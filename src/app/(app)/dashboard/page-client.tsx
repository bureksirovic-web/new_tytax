'use client';
import { DEFAULT_PROFILE_SETTINGS } from '@/contracts/domain';
import { SkeletonCard } from '@/components/ui/skeleton';
import { useT } from '@/lib/i18n/use-t';
import { LastWorkoutCard } from './_components/last-workout-card';
import { NoWorkoutsCard } from './_components/no-workouts-card';
import { PinnedCard } from './_components/pinned-card';
import { RecoveryCard } from './_components/recovery-card';
import { TodayCard } from './_components/today-card';
import { useDashboardData, useNow } from './_components/use-dashboard-data';
import { useForeignDraft } from './_components/use-foreign-draft';
import { useStartWorkout } from './_components/use-start-workout';
import { WeeklyVolumeCard } from './_components/weekly-volume-card';

export default function DashboardPage() {
  const { t } = useT();
  const now = useNow();
  const data = useDashboardData(now);
  const start = useStartWorkout(data.profile?.id);
  const foreign = useForeignDraft(data.profile?.id);
  const units = data.profile?.settings.units ?? DEFAULT_PROFILE_SETTINGS.units;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 bg-bg p-4 pb-24">
      <header className="pt-4">
        <h1 data-testid="page-heading-dashboard" className="font-display text-3xl font-bold uppercase tracking-wider text-highlight">
          {t('dash_title')}
        </h1>
      </header>

      {data.loading ? (
        <div role="status" aria-live="polite" aria-busy="true" data-testid="dash-loading" className="space-y-4">
          <span className="sr-only">{t('dash_loading')}</span>
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : data.failed ? (
        <p role="alert" data-testid="dash-error" className="rounded-xl border border-line bg-card p-4 text-sm text-fg">
          {t('dash_load_failed')}
        </p>
      ) : (
        <>
          <TodayCard program={data.program} start={start} foreign={foreign} />
          <PinnedCard units={units} />
          {data.lastLog ? (
            <div className="grid gap-4 md:grid-cols-2">
              <RecoveryCard recovery={data.recovery} failed={data.recoveryFailed} />
              <WeeklyVolumeCard volume={data.volume} units={units} />
              <div className="md:col-span-2">
                <LastWorkoutCard log={data.lastLog} units={units} />
              </div>
            </div>
          ) : (
            <NoWorkoutsCard start={start} />
          )}
        </>
      )}
    </div>
  );
}
