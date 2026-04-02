'use client';
import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db/dexie';
import { useWorkoutStore } from '@/stores/workout-store';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDuration } from '@/lib/utils';

export default function DebriefPage() {
  const router = useRouter();
  const { status, resetWorkout, sessionName, finishedData } = useWorkoutStore();

  const lastLog = useLiveQuery(() => db.workoutLogs.orderBy('date').last(), []);

  useEffect(() => {
    if (status === 'idle') {
      router.replace('/dashboard');
    }
  }, [status, router]);

  const handleSaveAndExit = () => {
    resetWorkout();
    router.push('/dashboard');
  };

  const data = finishedData || lastLog;

  const duration = data?.durationSeconds ?? 0;
  const prCount = data?.prCount ?? 0;
  const totalVolume = data?.totalVolumeKg ?? 0;
  const exerciseCount = data?.exercises.length ?? 0;

  return (
    <main className="min-h-screen p-4 pb-24" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <div className="mb-8 pt-4 text-center">
        <p className="text-xs tracking-widest uppercase mb-1" style={{ color: 'var(--accent)' }}>
          MISSION COMPLETE
        </p>
        <h1
          className="text-3xl font-bold tracking-wider uppercase"
          style={{ fontFamily: 'var(--font-display)', color: 'var(--highlight)' }}
        >
          DEBRIEF
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          {sessionName || data?.sessionName || 'Workout'}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-6">
        <Card>
          <p className="text-xs uppercase tracking-widest mb-1" style={{ color: 'var(--text-muted)' }}>DURATION</p>
          <p className="text-2xl font-bold" style={{ fontFamily: 'var(--font-mono)', color: 'var(--highlight)' }}>
            {formatDuration(duration)}
          </p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-widest mb-1" style={{ color: 'var(--text-muted)' }}>VOLUME</p>
          <p className="text-2xl font-bold" style={{ fontFamily: 'var(--font-mono)', color: 'var(--highlight)' }}>
            {Math.round(totalVolume).toLocaleString()}
            <span className="text-sm font-normal ml-1" style={{ color: 'var(--text-muted)' }}>kg</span>
          </p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-widest mb-1" style={{ color: 'var(--text-muted)' }}>EXERCISES</p>
          <p className="text-2xl font-bold" style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
            {exerciseCount}
          </p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-widest mb-1" style={{ color: 'var(--text-muted)' }}>NEW PRs</p>
          <p className="text-2xl font-bold" style={{ fontFamily: 'var(--font-mono)', color: prCount > 0 ? 'var(--accent)' : 'var(--text-primary)' }}>
            {prCount}
          </p>
        </Card>
      </div>

      {prCount > 0 && (
        <Card className="mb-6">
          <div className="flex items-center gap-3">
            <Badge variant="warning">NEW PR</Badge>
            <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              {prCount} personal record{prCount > 1 ? 's' : ''} set this session
            </p>
          </div>
        </Card>
      )}

      <Button fullWidth size="lg" onClick={handleSaveAndExit} className="uppercase tracking-widest font-bold mb-3">
        SAVE &amp; EXIT
      </Button>
      <Link href="/dashboard" className="block text-center text-sm" style={{ color: 'var(--text-muted)' }}>
        Back to Dashboard
      </Link>
    </main>
  );
}
