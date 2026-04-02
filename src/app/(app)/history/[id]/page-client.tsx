'use client';
import { use } from 'react';
import { useRouter } from 'next/navigation';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db/dexie';
import { useWorkoutStore } from '@/stores/workout-store';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDuration, formatWeight } from '@/lib/utils';
import { useLocale } from '@/components/providers';
import type { WorkoutLog, ExerciseLog } from '@/types/workout';

interface Props {
  params: Promise<{ id: string }>;
}

type ModalityBadge = 'tytax' | 'bodyweight' | 'kettlebell' | 'custom' | 'default';

function modalityVariant(mod: string): ModalityBadge {
  if (mod === 'tytax') return 'tytax';
  if (mod === 'bodyweight') return 'bodyweight';
  if (mod === 'kettlebell') return 'kettlebell';
  return 'default';
}

function ExerciseCard({ ex }: { ex: ExerciseLog }) {
  const { t } = useLocale();
  const workingSets = ex.sets.filter((s) => s.done);
  const exVol = workingSets.reduce((s, set) => s + set.kg * set.reps, 0);

  return (
    <Card className="mb-3">
      <div className="flex items-start justify-between mb-2">
        <div>
          <div
            className="font-semibold text-sm uppercase tracking-wide"
            style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}
          >
            {ex.exerciseName}
          </div>
          <div className="flex gap-1 mt-1">
            <Badge variant={modalityVariant(ex.modality)}>{ex.modality}</Badge>
            {ex.supersetGroup && (
              <Badge variant="default">{t('superset')} {ex.supersetGroup}</Badge>
            )}
          </div>
        </div>
        <div className="text-xs text-right" style={{ color: 'var(--text-muted)' }}>
          <div>{formatWeight(exVol)}</div>
          <div>{workingSets.length} {t('sets').toLowerCase()}</div>
        </div>
      </div>

      <div className="space-y-1">
        {ex.sets.map((set) => (
          <div
            key={set.id}
            className="flex items-center gap-3 text-xs py-1 px-2 rounded"
            style={{
              backgroundColor: set.done ? 'var(--bg-primary)' : 'transparent',
              color: set.done ? 'var(--text-primary)' : 'var(--text-muted)',
            }}
          >
            <span className="w-6 text-center font-mono" style={{ color: 'var(--text-muted)' }}>
              {set.setNumber}
            </span>
            <span className="font-medium">{formatWeight(set.kg)}</span>
            <span style={{ color: 'var(--text-muted)' }}>&times;</span>
            <span className="font-medium">{set.reps} {t('workout_reps').toLowerCase()}</span>
            {set.rir !== undefined && (
              <span style={{ color: 'var(--text-muted)' }}>RIR {set.rir}</span>
            )}
            {set.isPersonalRecord && (
              <Badge variant="warning">{t('workout_pr')}</Badge>
            )}
            {set.e1rm && set.e1rm > 0 && (
              <span className="ml-auto" style={{ color: 'var(--text-muted)' }}>
                e1RM {Math.round(set.e1rm)}
              </span>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}

export default function HistoryDetailPage({ params }: Props) {
  const { id } = use(params);
  const router = useRouter();
  const { t } = useLocale();
  const startWorkout = useWorkoutStore((s) => s.startWorkout);

  const log = useLiveQuery<WorkoutLog | undefined>(
    () => db.workoutLogs.get(id),
    [id]
  );

  if (log === undefined) {
    return (
      <div className="p-4 space-y-4">
        <Skeleton className="h-10 w-48 rounded" />
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    );
  }

  if (log === null) {
    return (
      <div className="p-4 text-center pt-20" style={{ color: 'var(--text-muted)' }}>
        {t('workout_not_found')}
      </div>
    );
  }

  const handleRepeat = async () => {
    await startWorkout({ modality: log.modalitiesUsed?.[0] || 'custom' });
    router.push('/workout/active');
  };

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <button
        onClick={() => router.back()}
        className="text-sm mb-4 block pt-2"
        style={{ color: 'var(--text-muted)' }}
      >
        &larr; {t('history')}
      </button>

      <Card className="mb-4">
        <div className="flex items-start justify-between mb-2">
          <div>
            <h1
              className="text-xl font-bold uppercase tracking-wider"
              style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}
            >
              {log.sessionName}
            </h1>
            <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
              {log.date} &mdash; {formatDuration(log.durationSeconds)}
            </div>
          </div>
          {log.prCount > 0 && (
            <Badge variant="warning">{log.prCount} PR{log.prCount > 1 ? 's' : ''}</Badge>
          )}
        </div>
        <div className="grid grid-cols-3 gap-3 mt-3">
          <div className="text-center">
            <div
              className="text-xl font-bold"
              style={{ color: 'var(--accent)', fontFamily: 'var(--font-display)' }}
            >
              {formatWeight(log.totalVolumeKg)}
            </div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('volume')}</div>
          </div>
          <div className="text-center">
            <div
              className="text-xl font-bold"
              style={{ color: 'var(--accent)', fontFamily: 'var(--font-display)' }}
            >
              {log.totalSets}
            </div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('sets')}</div>
          </div>
          <div className="text-center">
            <div
              className="text-xl font-bold"
              style={{ color: 'var(--accent)', fontFamily: 'var(--font-display)' }}
            >
              {log.exercises.length}
            </div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('exercise_plural')}</div>
          </div>
        </div>
        {log.rpe && (
          <div className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
            RPE: {log.rpe}/10
          </div>
        )}
        {log.notes && (
          <div className="mt-2 text-xs p-2 rounded" style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-secondary)' }}>
            {log.notes}
          </div>
        )}
      </Card>

      {log.exercises.map((ex, i) => (
        <ExerciseCard key={`${ex.exerciseRef}-${i}`} ex={ex} />
      ))}

      <div className="mt-4 pb-6">
        <Button fullWidth onClick={handleRepeat} size="lg">
          {t('repeat_workout')}
        </Button>
      </div>
    </div>
  );
}
