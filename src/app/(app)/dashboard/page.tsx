'use client';
import { useRouter } from 'next/navigation';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db/dexie';
import { useWorkoutStore } from '@/stores/workout-store';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDuration, getWeekKey } from '@/lib/utils';
import type { WorkoutLog } from '@/types/workout';
import type { Program } from '@/types/program';

export default function DashboardPage() {
  const router = useRouter();
  const startWorkout = useWorkoutStore((s) => s.startWorkout);

  const lastLog = useLiveQuery<WorkoutLog | undefined>(
    () => db.workoutLogs.orderBy('date').last(),
    []
  );

  const weekLogs = useLiveQuery<WorkoutLog[]>(async () => {
    const thisWeek = getWeekKey();
    // Fetch last 7 days of logs
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 7);
    const cutoffStr = cutoff.toISOString().split('T')[0];
    return db.workoutLogs.where('date').aboveOrEqual(cutoffStr).toArray();
  }, []);

  const activeProgram = useLiveQuery<Program | undefined>(
    () => db.programs.where('isActive').equals(1).first(),
    []
  );

  const weekVolume = weekLogs?.reduce((sum, l) => sum + (l.totalVolumeKg ?? 0), 0) ?? 0;
  const weekCount = weekLogs?.length ?? 0;

  const handleQuickStart = () => {
    const quickSession = {
      id: crypto.randomUUID(),
      programId: '',
      name: 'Quick Workout',
      dayIndex: 0,
      exercises: [],
    };
    startWorkout(quickSession);
    router.push('/workout/active');
  };

  return (
    <main className="min-h-screen p-4 pb-24" style={{ backgroundColor: 'var(--bg-primary)' }}>
      {/* Header */}
      <div className="mb-6 pt-4">
        <p className="text-xs tracking-widest uppercase mb-1" style={{ color: 'var(--text-muted)' }}>TYTAX SYSTEM</p>
        <h1
          className="text-3xl font-bold tracking-wider uppercase"
          style={{ fontFamily: 'var(--font-display)', color: 'var(--highlight)' }}
        >
          COMMAND CENTER
        </h1>
      </div>

      {/* CTA */}
      <Button fullWidth size="lg" onClick={handleQuickStart} className="uppercase tracking-widest font-bold mb-6 min-h-[64px] text-lg">
        START WORKOUT
      </Button>

      {/* Weekly stats */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <Card>
          <p className="text-xs uppercase tracking-widest mb-1" style={{ color: 'var(--text-muted)' }}>THIS WEEK</p>
          <p className="text-2xl font-bold" style={{ fontFamily: 'var(--font-mono)', color: 'var(--highlight)' }}>
            {weekCount}
            <span className="text-sm font-normal ml-1" style={{ color: 'var(--text-muted)' }}>sessions</span>
          </p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-widest mb-1" style={{ color: 'var(--text-muted)' }}>VOLUME</p>
          <p className="text-2xl font-bold" style={{ fontFamily: 'var(--font-mono)', color: 'var(--highlight)' }}>
            {weekVolume > 0 ? `${Math.round(weekVolume / 1000).toLocaleString()}t` : '—'}
          </p>
        </Card>
      </div>

      {/* Last workout */}
      {lastLog ? (
        <Card className="mb-4">
          <CardHeader>
            <CardTitle>LAST WORKOUT</CardTitle>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{lastLog.date}</span>
          </CardHeader>
          <h3 className="font-bold uppercase tracking-wide mb-2" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>
            {lastLog.sessionName}
          </h3>
          <div className="flex gap-4 text-sm">
            <span style={{ color: 'var(--text-secondary)' }}>
              {lastLog.exercises.length} exercises
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
          <p className="text-sm py-2" style={{ color: 'var(--text-muted)' }}>No workouts logged yet. Hit START to begin.</p>
        </Card>
      )}

      {/* Active program */}
      {activeProgram && (
        <Card>
          <CardHeader>
            <CardTitle>ACTIVE PROGRAM</CardTitle>
            <Badge variant="success">ON</Badge>
          </CardHeader>
          <h3 className="font-bold uppercase tracking-wide" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>
            {activeProgram.name}
          </h3>
          {(() => {
            const idx = activeProgram.currentSessionIndex ?? 0;
            const session = activeProgram.sessions[idx % activeProgram.sessions.length];
            return session ? (
              <p className="text-sm mt-1" style={{ color: 'var(--accent)' }}>
                Next: {session.name} — {session.exercises.length} exercises
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
            VIEW PROGRAM SESSION
          </Button>
        </Card>
      )}
    </main>
  );
}
