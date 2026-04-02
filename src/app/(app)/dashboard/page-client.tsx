'use client';
import { useRouter } from 'next/navigation';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db/dexie';
import { useWorkoutStore } from '@/stores/workout-store';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDuration } from '@/lib/utils';
import { useLocale } from '@/components/providers';
import type { WorkoutLog } from '@/types/workout';
import type { Program } from '@/types/program';

export default function DashboardPage() {
  const router = useRouter();
  const { t } = useLocale();
  const startWorkout = useWorkoutStore((s) => s.startWorkout);

  const lastLog = useLiveQuery<WorkoutLog | undefined>(
    () => db.workoutLogs.orderBy('date').last(),
    []
  );

  const weekLogs = useLiveQuery<WorkoutLog[]>(async () => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 7);
    const cutoffStr = cutoff.toISOString().split('T')[0];
    return db.workoutLogs.where('date').aboveOrEqual(cutoffStr).toArray();
  }, []);

  const activeProgram = useLiveQuery<Program | undefined>(
    () => db.programs.where('isActive').equals(1).and((p) => !p.deletedAt).first(),
    []
  );

  const weekVolume = weekLogs?.reduce((sum, l) => sum + (l.totalVolumeKg ?? 0), 0) ?? 0;
  const weekCount = weekLogs?.length ?? 0;

  const handleQuickStart = async () => {
    await startWorkout({});
    router.push('/workout/active');
  };

  return (
    <main className="min-h-screen p-4 pb-24" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <div className="mb-6 pt-4">
        <p className="text-xs tracking-widest uppercase mb-1" style={{ color: 'var(--text-muted)' }}>{t('dashboard_system')}</p>
        <h1
          className="text-3xl font-bold tracking-wider uppercase"
          style={{ fontFamily: 'var(--font-display)', color: 'var(--highlight)' }}
        >
          {t('dashboard_title')}
        </h1>
      </div>

      <Button fullWidth size="lg" onClick={handleQuickStart} className="uppercase tracking-widest font-bold mb-6 min-h-[64px] text-lg">
        {t('workout_start')}
      </Button>

      <div className="grid grid-cols-2 gap-3 mb-6">
        <Card>
          <p className="text-xs uppercase tracking-widest mb-1" style={{ color: 'var(--text-muted)' }}>{t('dashboard_this_week')}</p>
          <p className="text-2xl font-bold" style={{ fontFamily: 'var(--font-mono)', color: 'var(--highlight)' }}>
            {weekCount}
            <span className="text-sm font-normal ml-1" style={{ color: 'var(--text-muted)' }}>{t('dashboard_sessions')}</span>
          </p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-widest mb-1" style={{ color: 'var(--text-muted)' }}>{t('dashboard_volume')}</p>
          <p className="text-2xl font-bold" style={{ fontFamily: 'var(--font-mono)', color: 'var(--highlight)' }}>
            {weekVolume > 0 ? `${Math.round(weekVolume / 1000).toLocaleString()}t` : '—'}
          </p>
        </Card>
      </div>

      {lastLog ? (
        <Card className="mb-4">
          <CardHeader>
            <CardTitle>{t('dashboard_last_workout')}</CardTitle>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{lastLog.date}</span>
          </CardHeader>
          <h3 className="font-bold uppercase tracking-wide mb-2" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>
            {lastLog.sessionName}
          </h3>
          <div className="flex gap-4 text-sm">
            <span style={{ color: 'var(--text-secondary)' }}>
              {lastLog.exercises.length} {t('dashboard_exercises')}
            </span>
            <span style={{ color: 'var(--text-secondary)' }}>
              {formatDuration(lastLog.durationSeconds)}
            </span>
            <span style={{ color: 'var(--text-secondary)' }}>
              {Math.round(lastLog.totalVolumeKg).toLocaleString()} kg
            </span>
          </div>
          {lastLog.prCount > 0 && (
            <Badge variant="warning" className="mt-2">{lastLog.prCount} PR{lastLog.prCount > 1 ? 's' : ''}</Badge>
          )}
        </Card>
      ) : (
        <Card className="mb-4">
          <p className="text-sm py-2" style={{ color: 'var(--text-muted)' }}>{t('dashboard_no_workouts')}</p>
        </Card>
      )}

      {activeProgram && (
        <Card>
          <CardHeader>
            <CardTitle>{t('dashboard_active_program')}</CardTitle>
            <Badge variant="success">{t('dashboard_on')}</Badge>
          </CardHeader>
          <h3 className="font-bold uppercase tracking-wide" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>
            {activeProgram.name}
          </h3>
          {(() => {
            const idx = activeProgram.currentSessionIndex ?? 0;
            const session = activeProgram.sessions[idx % activeProgram.sessions.length];
            return session ? (
              <p className="text-sm mt-1" style={{ color: 'var(--accent)' }}>
                {t('dashboard_next')}: {session.name} — {session.exercises.length} {t('dashboard_exercises')}
              </p>
            ) : null;
          })()}
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
