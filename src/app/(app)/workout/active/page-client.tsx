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
import { useLocale } from '@/components/providers';

function RestTimer({ seconds, isRunning, progress, skip }: {
  seconds: number; isRunning: boolean; progress: number; skip: () => void;
}) {
  const { t } = useLocale();
  if (!isRunning) return null;
  return (
    <div className="fixed bottom-20 left-0 right-0 z-50 px-4">
      <Card className="flex items-center gap-4 py-3">
        <div className="flex-1">
          <p className="text-xs uppercase tracking-widest mb-1" style={{ color: 'var(--text-muted)' }}>{t('workout_rest')}</p>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--border-color)' }}>
            <div className="h-full rounded-full transition-all duration-1000"
              style={{ width: `${(1 - progress) * 100}%`, backgroundColor: 'var(--accent)' }} />
          </div>
        </div>
        <span className="text-2xl font-bold tabular-nums"
          style={{ fontFamily: 'var(--font-mono)', color: 'var(--highlight)' }}>
          {formatDuration(seconds)}
        </span>
        <Button variant="ghost" size="sm" onClick={skip}>{t('workout_skip')}</Button>
      </Card>
    </div>
  );
}

export default function ActiveWorkoutPage() {
  const router = useRouter();
  const { t } = useLocale();
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
    <main className="min-h-screen p-4 pb-24 flex flex-col items-center justify-center gap-6"
      style={{ backgroundColor: 'var(--bg-primary)' }}>
      <div className="text-center">
        <p className="text-xs uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>
          {t('workout_active_label')}
        </p>
        <h2 className="text-2xl font-bold uppercase tracking-wider"
          style={{ fontFamily: 'var(--font-display)', color: 'var(--highlight)' }}>
          {t('workout_add_first_title')}
        </h2>
        <p className="text-sm mt-2" style={{ color: 'var(--text-muted)' }}>
          {t('workout_first_exercise_desc')}
        </p>
      </div>
      <Button size="lg" fullWidth onClick={() => router.push('/exercises')}
        className="text-lg uppercase tracking-widest font-bold py-5 max-w-sm"
        style={{ fontFamily: 'var(--font-display)' }}>
        {t('workout_browse_exercises_btn')}
      </Button>
      <Button variant="ghost" onClick={() => { workout.resetWorkout(); router.push('/workout'); }}>
        {t('workout_cancel_btn')}
      </Button>
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
                {t('workout_warmup_btn')}
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
          <CardTitle>{t('workout_log_set')}</CardTitle>
          {isPR && <Badge variant="warning">{prType === 'weight' ? t('workout_weight_pr') : prType === 'reps' ? t('workout_reps_pr') : t('workout_volume_pr')}</Badge>}
        </CardHeader>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <p className="text-xs uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>{t('workout_weight_kg')}</p>
            <NumberStepper value={weight} onChange={setWeight} step={2.5} smallStep={1.25} min={0} max={500} format={(v) => `${v}`} />
          </div>
          <div>
            <p className="text-xs uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>{t('workout_reps_label')}</p>
            <NumberStepper value={reps} onChange={setReps} step={1} min={1} max={100} format={(v) => `${v}`} />
          </div>
        </div>
        <Button fullWidth size="lg" onClick={handleLogSet} className="uppercase tracking-widest font-bold">{t('workout_log_set')}</Button>
      </Card>

      {doneSets.length > 0 && (
        <Card className="mb-4">
          <CardHeader>
            <CardTitle>{t('workout_sets_done_label')}</CardTitle>
            <span className="text-sm font-bold" style={{ color: 'var(--accent)' }}>{doneSets.length}</span>
          </CardHeader>
          <div className="space-y-2">
            {doneSets.map((s, i) => (
              <div key={s.id} className="flex items-center justify-between text-sm">
                <span style={{ color: 'var(--text-muted)' }}>{t('workout_set_label')} {i + 1}</span>
                <span style={{ color: 'var(--text-primary)' }} className="font-mono font-bold">
                  {s.kg} kg x {s.reps}
                  {s.isPersonalRecord && <span className="ml-2 text-xs" style={{ color: 'var(--highlight)' }}>{t('workout_pr')}</span>}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Button variant="ghost" size="md" fullWidth onClick={() => router.push('/exercises')}
        className="uppercase tracking-wider mb-3 border border-dashed"
        style={{ borderColor: 'var(--border-color)' }}>
        {t('workout_add_exercise_btn')}
      </Button>
      <Button variant="secondary" size="md" fullWidth onClick={handleNextExercise} className="uppercase tracking-wider mb-3">
        {exerciseIndex === workout.exercises.length - 1 ? t('workout_finish') : t('workout_next_exercise')}
      </Button>
      <Button variant="danger" size="sm" fullWidth onClick={handleFinish} loading={saving} className="uppercase tracking-widest">
        {t('workout_end')}
      </Button>

      <RestTimer seconds={timer.seconds} isRunning={timer.isRunning} progress={timer.progress} skip={timer.skip} />
    </main>
  );
}
