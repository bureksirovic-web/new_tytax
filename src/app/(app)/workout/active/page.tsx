'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useWorkout } from '@/hooks/use-workout';
import { useTimer } from '@/hooks/use-timer';
import { usePRCheck } from '@/hooks/use-pr';
import { useUIStore } from '@/stores/ui-store';
import { Button } from '@/components/ui/button';
import { NumberStepper } from '@/components/ui/number-stepper';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDuration } from '@/lib/utils';
import { WarmupCalculator } from '@/components/workout/warmup-calculator';

function RestTimer({ seconds, isRunning, progress, skip }: {
  seconds: number; isRunning: boolean; progress: number; skip: () => void;
}) {
  if (!isRunning) return null;
  return (
    <div className="fixed bottom-20 left-0 right-0 z-50 px-4">
      <Card className="flex items-center gap-4 py-3">
        <div className="flex-1">
          <p className="text-xs uppercase tracking-widest mb-1" style={{ color: 'var(--text-muted)' }}>REST</p>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--border-color)' }}>
            <div className="h-full rounded-full transition-all duration-1000"
              style={{ width: `${(1 - progress) * 100}%`, backgroundColor: 'var(--accent)' }} />
          </div>
        </div>
        <span className="text-2xl font-bold tabular-nums"
          style={{ fontFamily: 'var(--font-mono)', color: 'var(--highlight)' }}>
          {formatDuration(seconds)}
        </span>
        <Button variant="ghost" size="sm" onClick={skip}>SKIP</Button>
      </Card>
    </div>
  );
}

export default function ActiveWorkoutPage() {
  const router = useRouter();
  const workout = useWorkout();
  const timer = useTimer(90);
  const toggleFocusMode = useUIStore((s) => s.toggleFocusMode);
  const [weight, setWeight] = useState(0);
  const [reps, setReps] = useState(10);
  const [saving, setSaving] = useState(false);
  const [showWarmup, setShowWarmup] = useState(false);

  const currentEx = workout.currentExercise;
  const currentSets = currentEx ? (workout.sets[currentEx.exerciseRef] || []) : [];
  const exerciseIndex = workout.currentExerciseIndex;

  const { isPR, prType } = usePRCheck(currentEx?.exerciseRef ?? '', weight, reps);

  useEffect(() => {
    if (workout.status !== 'active') router.replace('/workout');
  }, [workout.status, router]);

  useEffect(() => {
    toggleFocusMode();
    return () => toggleFocusMode();
  }, [toggleFocusMode]);

  if (!currentEx) return (
    <main className="p-4" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <p style={{ color: 'var(--text-muted)' }}>No exercises in this session.</p>
      <Button className="mt-4" onClick={() => router.push('/workout')}>Back</Button>
      {process.env.NODE_ENV === 'development' && (
        <Button className="mt-4 ml-2" onClick={() => {
          workout.exercises.push({
            exerciseRef: 'ex1',
            exerciseName: 'Squat',
            modality: 'tytax',
            sets: [{ id: '1', setNumber: 1, type: 'working', kg: 0, reps: 0, done: false, timestamp: new Date().toISOString() }],
          });
          setExerciseIndex(0);
          setWeight(60);
        }}>Inject Demo Exercise</Button>
      )}
    </main>
  );

  const doneSets = currentSets.filter((s) => s.done);

  const handleLogSet = () => {
    if (!currentEx) return;
    const nextPending = currentSets.findIndex((s) => !s.done);
    if (nextPending === -1) {
      workout.addSet(currentEx.exerciseRef);
      workout.updateSet(currentEx.exerciseRef, currentSets.length, { kg: weight, reps, done: true, isPersonalRecord: isPR });
    } else {
      workout.updateSet(currentEx.exerciseRef, nextPending, { kg: weight, reps, done: true, isPersonalRecord: isPR });
    }
    timer.start(currentEx.restSeconds ?? 90);
  };

  const handleFinish = async () => {
    setSaving(true);
    try { await workout.finishAndSave(); router.push('/workout/debrief'); }
    finally { setSaving(false); }
  };

  const handleNextExercise = () => {
    if (exerciseIndex < workout.exercises.length - 1) {
      workout.setCurrentExerciseIndex(exerciseIndex + 1);
      setWeight(0); setReps(10); timer.reset();
    } else { handleFinish(); }
  };

  return (
    <main className="min-h-screen p-4 pb-32" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
            {exerciseIndex + 1} / {workout.exercises.length}
          </span>
          <div className="flex gap-2">
            {weight > 0 && (
              <Button variant="secondary" size="sm" onClick={() => setShowWarmup(w => !w)}>
                WARMUP
              </Button>
            )}
            <Badge variant="default">{currentEx.modality}</Badge>
          </div>
        </div>
        <h2 className="text-2xl font-bold uppercase tracking-wide"
          style={{ fontFamily: 'var(--font-display)', color: 'var(--highlight)' }}>
          {currentEx.exerciseName}
        </h2>
        {currentEx.muscleImpactSnapshot?.[0] && (
          <p className="text-sm mt-0.5" style={{ color: 'var(--accent)' }}>
            {currentEx.muscleImpactSnapshot[0].muscle}
          </p>
        )}
      </div>

      {showWarmup && weight > 0 && (
        <div className="mb-4">
          <WarmupCalculator workingWeight={weight} onClose={() => setShowWarmup(false)} />
        </div>
      )}

      <Card className="mb-4">
        <CardHeader>
          <CardTitle>LOG SET</CardTitle>
          {isPR && <Badge variant="warning">{prType === 'weight' ? 'WEIGHT PR' : prType === 'reps' ? 'REPS PR' : 'VOLUME PR'}</Badge>}
        </CardHeader>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <p className="text-xs uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>WEIGHT (kg)</p>
            <NumberStepper value={weight} onChange={setWeight} step={2.5} smallStep={1.25} min={0} max={500} format={(v) => `${v}`} />
          </div>
          <div>
            <p className="text-xs uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>REPS</p>
            <NumberStepper value={reps} onChange={setReps} step={1} min={1} max={100} format={(v) => `${v}`} />
          </div>
        </div>
        <Button fullWidth size="lg" onClick={handleLogSet} className="uppercase tracking-widest font-bold">LOG SET</Button>
      </Card>

      {doneSets.length > 0 && (
        <Card className="mb-4">
          <CardHeader>
            <CardTitle>SETS DONE</CardTitle>
            <span className="text-sm font-bold" style={{ color: 'var(--accent)' }}>{doneSets.length}</span>
          </CardHeader>
          <div className="space-y-2">
            {doneSets.map((s, i) => (
              <div key={s.id} className="flex items-center justify-between text-sm">
                <span style={{ color: 'var(--text-muted)' }}>Set {i + 1}</span>
                <span style={{ color: 'var(--text-primary)' }} className="font-mono font-bold">
                  {s.kg} kg x {s.reps}
                  {s.isPersonalRecord && <span className="ml-2 text-xs" style={{ color: 'var(--highlight)' }}>PR</span>}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Button variant="secondary" size="md" fullWidth onClick={handleNextExercise} className="uppercase tracking-wider mb-3">
        {exerciseIndex === workout.exercises.length - 1 ? 'FINISH' : 'NEXT EXERCISE'}
      </Button>
      <Button variant="danger" size="sm" fullWidth onClick={handleFinish} loading={saving} className="uppercase tracking-widest">
        END WORKOUT
      </Button>

      <RestTimer seconds={timer.seconds} isRunning={timer.isRunning} progress={timer.progress} skip={timer.skip} />
    </main>
  );
}
