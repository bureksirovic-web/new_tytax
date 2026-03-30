'use client';
import { useRouter } from 'next/navigation';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db/dexie';
import { useWorkoutStore } from '@/stores/workout-store';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { Program } from '@/types/program';

export default function WorkoutPage() {
  const router = useRouter();
  const startWorkout = useWorkoutStore((s) => s.startWorkout);
  const storeStatus = useWorkoutStore((s) => s.status);

  const activeProgram = useLiveQuery<Program | undefined>(
    () => db.programs.where('isActive').equals(1).first(),
    []
  );

  const handleQuickStart = async () => {
    await startWorkout({});
    router.push('/workout/active');
  };

  const handleProgramStart = async () => {
    if (!activeProgram) return;
    const idx = activeProgram.currentSessionIndex ?? 0;
    const session = activeProgram.sessions[idx % activeProgram.sessions.length];
    if (!session) return;
    await startWorkout({ programSessionId: session.id });
    router.push('/workout/active');
  };

  // If already in an active workout, jump straight to it
  if (storeStatus === 'active') {
    router.push('/workout/active');
    return null;
  }

  return (
    <main className="min-h-screen p-4 pb-24" style={{ backgroundColor: 'var(--bg-primary)' }}>
      {/* Header */}
      <div className="mb-8 pt-4">
        <p className="text-xs tracking-widest uppercase mb-1" style={{ color: 'var(--text-muted)' }}>
          TYTAX SYSTEM
        </p>
        <h1
          className="text-4xl font-bold tracking-wider uppercase"
          style={{ fontFamily: 'var(--font-display)', color: 'var(--highlight)' }}
        >
          TRAINING OPS
        </h1>
      </div>

      {/* Quick Start CTA */}
      <div className="mb-6">
        <Button
          size="lg"
          fullWidth
          onClick={handleQuickStart}
          className="text-xl tracking-widest uppercase font-bold py-6 min-h-[72px]"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          START WORKOUT
        </Button>
        <p className="text-xs text-center mt-2" style={{ color: 'var(--text-muted)' }}>
          Free session — add exercises as you go
        </p>
      </div>

      {/* Divider */}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex-1 h-px" style={{ backgroundColor: 'var(--border-color)' }} />
        <span className="text-xs uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
          or continue program
        </span>
        <div className="flex-1 h-px" style={{ backgroundColor: 'var(--border-color)' }} />
      </div>

      {/* Active Program Card */}
      {activeProgram ? (
        <Card hoverable onClick={handleProgramStart}>
          <CardHeader>
            <CardTitle>ACTIVE PROGRAM</CardTitle>
            <Badge variant="success">ACTIVE</Badge>
          </CardHeader>
          <h2
            className="text-xl font-bold uppercase tracking-wide mb-1"
            style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}
          >
            {activeProgram.name}
          </h2>
          {(() => {
            const idx = activeProgram.currentSessionIndex ?? 0;
            const session = activeProgram.sessions[idx % activeProgram.sessions.length];
            return session ? (
              <div className="mt-3">
                <p className="text-xs uppercase tracking-widest mb-1" style={{ color: 'var(--text-muted)' }}>
                  NEXT SESSION
                </p>
                <p className="font-semibold" style={{ color: 'var(--accent)' }}>
                  {session.name}
                </p>
                <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                  {session.exercises.length} exercises
                </p>
              </div>
            ) : null;
          })()}
          <Button fullWidth variant="secondary" className="mt-4 uppercase tracking-widest" size="md">
            CONTINUE PROGRAM
          </Button>
        </Card>
      ) : (
        <Card>
          <p className="text-sm text-center py-4" style={{ color: 'var(--text-muted)' }}>
            No active program. Build one in Programs to track structured progress.
          </p>
        </Card>
      )}
    </main>
  );
}
