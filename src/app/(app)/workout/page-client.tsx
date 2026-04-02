'use client';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db/dexie';
import { useWorkoutStore } from '@/stores/workout-store';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useLocale } from '@/components/providers';
import type { Program } from '@/types/program';

export default function WorkoutPage() {
  const router = useRouter();
  const { t } = useLocale();
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

  useEffect(() => {
    if (storeStatus === 'active') {
      router.replace('/workout/active');
    }
  }, [storeStatus, router]);

  return (
    <main className="min-h-screen p-4 pb-24" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <div className="mb-8 pt-4">
        <p className="text-xs tracking-widest uppercase mb-1" style={{ color: 'var(--text-muted)' }}>
          {t('dashboard_system')}
        </p>
        <h1
          className="text-4xl font-bold tracking-wider uppercase"
          style={{ fontFamily: 'var(--font-display)', color: 'var(--highlight)' }}
        >
          {t('training_title')}
        </h1>
      </div>

      <div className="mb-6">
        <Button
          size="lg"
          fullWidth
          onClick={handleQuickStart}
          className="text-xl tracking-widest uppercase font-bold py-6 min-h-[72px]"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {t('workout_start')}
        </Button>
        <p className="text-xs text-center mt-2" style={{ color: 'var(--text-muted)' }}>
          {t('training_free_session')}
        </p>
      </div>

      <div className="flex items-center gap-3 mb-6">
        <div className="flex-1 h-px" style={{ backgroundColor: 'var(--border-color)' }} />
        <span className="text-xs uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
          {t('training_or_continue')}
        </span>
        <div className="flex-1 h-px" style={{ backgroundColor: 'var(--border-color)' }} />
      </div>

      {activeProgram ? (
        <Card hoverable onClick={handleProgramStart}>
          <CardHeader>
            <CardTitle>{t('training_active_program')}</CardTitle>
            <Badge variant="success">{t('training_active')}</Badge>
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
                  {t('training_next_session')}
                </p>
                <p className="font-semibold" style={{ color: 'var(--accent)' }}>
                  {session.name}
                </p>
                <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                  {session.exercises.length} {t('training_exercises')}
                </p>
              </div>
            ) : null;
          })()}
          <Button fullWidth variant="secondary" className="mt-4 uppercase tracking-widest" size="md">
            {t('training_continue_program')}
          </Button>
        </Card>
      ) : (
        <Card>
          <p className="text-sm text-center py-4" style={{ color: 'var(--text-muted)' }}>
            {t('training_no_program')}
          </p>
        </Card>
      )}
    </main>
  );
}
