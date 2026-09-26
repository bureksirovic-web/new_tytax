'use client';
import { useRouter } from 'next/navigation';
import { useActiveProfile, useRepoQuery } from '@/hooks/use-repo';
import { useWorkoutHydrated, useWorkoutStore } from '@/stores/workout-store';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDuration } from '@/lib/utils';
import { getCurrentSession } from '@/lib/programs/utils';
import { useLocale } from '@/components/providers';

/** Local calendar day (`'YYYY-MM-DD'`) `days` days before today. */
function localDayDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export default function DashboardPage() {
  const router = useRouter();
  const { t } = useLocale();
  const hydrated = useWorkoutHydrated();
  const draft = useWorkoutStore((s) => s.draft);
  const startQuick = useWorkoutStore((s) => s.startQuick);
  const { profileId, loading: profileLoading } = useActiveProfile();

  const { data: lastLogs } = useRepoQuery(
    async (repo) => (profileId ? repo.logs.list(profileId, { limit: 1 }) : []),
    [profileId],
  );
  const { data: weekLogs } = useRepoQuery(
    async (repo) => (profileId ? repo.logs.list(profileId, { from: localDayDaysAgo(7) }) : []),
    [profileId],
  );
  const { data: activeProgram } = useRepoQuery(
    async (repo) => (profileId ? repo.programs.getActive(profileId) : undefined),
    [profileId],
  );

  const lastLog = lastLogs?.[0];
  // Nothing to say about history until the profile and its logs have loaded.
  const historyLoaded = !profileLoading && lastLogs !== undefined;
  const weekVolume = weekLogs?.reduce((sum, l) => sum + (l.totalVolumeKg ?? 0), 0) ?? 0;
  const weekCount = weekLogs?.length ?? 0;
  const nextSession = activeProgram ? getCurrentSession(activeProgram) : null;

  const handleQuickStart = () => {
    // Never replace an in-progress workout: resume it instead.
    if (draft) {
      router.push('/workout/active');
      return;
    }
    if (!profileId) return;
    startQuick(profileId, t('nav_workout'));
    router.push('/workout/active');
  };

  return (
    <main className="min-h-screen bg-[var(--bg-primary)] p-4 pb-24">
      <div className="mb-6 pt-4">
        <p className="mb-1 text-xs uppercase tracking-widest text-[var(--text-muted)]">{t('dashboard_system')}</p>
        <h1 className="font-display text-3xl font-bold uppercase tracking-wider text-[var(--highlight)]">
          {t('dashboard_title')}
        </h1>
      </div>

      <Button
        fullWidth
        size="lg"
        disabled={!hydrated || (!draft && !profileId)}
        onClick={handleQuickStart}
        className="mb-6 min-h-[64px] text-lg font-bold uppercase tracking-widest"
      >
        {draft ? t('workout_session_active') : t('workout_start')}
      </Button>

      <div className="mb-6 grid grid-cols-2 gap-3">
        <Card>
          <p className="mb-1 text-xs uppercase tracking-widest text-[var(--text-muted)]">{t('dashboard_this_week')}</p>
          <p className="font-mono text-2xl font-bold text-[var(--highlight)]">
            {weekCount}
            <span className="ml-1 text-sm font-normal text-[var(--text-muted)]">{t('dashboard_sessions')}</span>
          </p>
        </Card>
        <Card>
          <p className="mb-1 text-xs uppercase tracking-widest text-[var(--text-muted)]">{t('dashboard_volume')}</p>
          <p className="font-mono text-2xl font-bold text-[var(--highlight)]">
            {weekVolume > 0 ? `${Math.round(weekVolume / 1000).toLocaleString()}t` : '—'}
          </p>
        </Card>
      </div>

      {lastLog ? (
        <Card className="mb-4">
          <CardHeader>
            <CardTitle>{t('dashboard_last_workout')}</CardTitle>
            <span className="text-xs text-[var(--text-muted)]">{lastLog.date}</span>
          </CardHeader>
          <h3 className="mb-2 font-display font-bold uppercase tracking-wide text-[var(--text-primary)]">
            {lastLog.sessionName}
          </h3>
          <div className="flex gap-4 text-sm text-[var(--text-secondary)]">
            <span>
              {lastLog.exercises.length} {t('dashboard_exercises')}
            </span>
            <span>{formatDuration(lastLog.durationSeconds)}</span>
            <span>{Math.round(lastLog.totalVolumeKg).toLocaleString()} kg</span>
          </div>
          {lastLog.prCount > 0 && (
            <Badge variant="warning" className="mt-2">
              {lastLog.prCount} {t('workout_pr')}
            </Badge>
          )}
        </Card>
      ) : historyLoaded ? (
        <Card className="mb-4">
          <p className="py-2 text-sm text-[var(--text-muted)]">{t('dashboard_no_workouts')}</p>
        </Card>
      ) : null}

      {activeProgram && (
        <Card>
          <CardHeader>
            <CardTitle>{t('dashboard_active_program')}</CardTitle>
            <Badge variant="success">{t('dashboard_on')}</Badge>
          </CardHeader>
          <h3 className="font-display font-bold uppercase tracking-wide text-[var(--text-primary)]">
            {activeProgram.name}
          </h3>
          {nextSession && (
            <p className="mt-1 text-sm text-[var(--accent)]">
              {t('dashboard_next')}: {nextSession.name} — {nextSession.exercises.length} {t('dashboard_exercises')}
            </p>
          )}
          <Button
            variant="secondary"
            size="sm"
            fullWidth
            className="mt-3 uppercase tracking-widest"
            onClick={() => router.push('/workout')}
          >
            {t('dashboard_view_program_session')}
          </Button>
        </Card>
      )}
    </main>
  );
}
