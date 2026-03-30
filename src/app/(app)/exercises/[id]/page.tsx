'use client';
import { use, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { TYTAX_EXERCISES } from '@/data/tytax/exercises';
import { BODYWEIGHT_EXERCISES } from '@/data/bodyweight/exercises';
import { KB_EXERCISES } from '@/data/kettlebell/exercises';
import { PROGRESSION_CHAINS } from '@/data/bodyweight/progressions';
import { db } from '@/lib/db/dexie';
import { useWorkoutStore } from '@/stores/workout-store';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { generateId, isoDate } from '@/lib/utils';
import type { Exercise } from '@/types/exercise';
import type { ExerciseLog } from '@/types/workout';

const ALL_EXERCISES: Exercise[] = [...TYTAX_EXERCISES, ...BODYWEIGHT_EXERCISES, ...KB_EXERCISES];

function MuscleBar({ muscle, score }: { muscle: string; score: number }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs w-32 flex-shrink-0 truncate" style={{ color: 'var(--text-secondary)' }}>
        {muscle}
      </span>
      <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg-secondary)' }}>
        <div
          className="h-full rounded-full"
          style={{ width: `${score}%`, backgroundColor: 'var(--accent)' }}
        />
      </div>
      <span className="text-xs w-8 text-right tabular-nums" style={{ color: 'var(--text-muted)' }}>
        {score}
      </span>
    </div>
  );
}

export default function ExerciseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const found = ALL_EXERCISES.find((e) => e.id === id);

  const workoutStatus = useWorkoutStore((s) => s.status);
  const workoutExercises = useWorkoutStore((s) => s.exercises);

  const [note, setNote] = useState('');
  const [noteSaved, setNoteSaved] = useState(false);

  useEffect(() => {
    if (!found) return;
    db.exerciseNotes.where('exerciseId').equals(found.id).first()
      .then((n) => { if (n) setNote(n.content); })
      .catch(() => {});
  }, [found]);

  if (!found) {
    return (
      <EmptyState
        icon="◈"
        title="Exercise not found"
        description={`No exercise with id "${id}"`}
        action={{ label: 'Back to library', onClick: () => router.push('/exercises') }}
      />
    );
  }

  // Narrowed: found is Exercise from here
  const exercise: Exercise = found;

  const modalityVariant = exercise.modality as 'tytax' | 'bodyweight' | 'kettlebell' | 'custom';

  // Progression chain for bodyweight exercises
  const chain =
    exercise.modality === 'bodyweight'
      ? PROGRESSION_CHAINS.find((c) => c.exercises.includes(exercise.id))
      : null;
  const chainIndex = chain ? chain.exercises.indexOf(exercise.id) : -1;
  const prevId = chain && chainIndex > 0 ? chain.exercises[chainIndex - 1] : null;
  const nextId =
    chain && chainIndex < chain.exercises.length - 1 ? chain.exercises[chainIndex + 1] : null;
  const prevExercise = prevId ? ALL_EXERCISES.find((e) => e.id === prevId) : null;
  const nextExercise = nextId ? ALL_EXERCISES.find((e) => e.id === nextId) : null;

  const isWorkoutActive = workoutStatus === 'active';
  const alreadyInWorkout = workoutExercises.some((e) => e.exerciseRef === exercise.id);

  function handleAddToWorkout() {
    const newLog: ExerciseLog = {
      exerciseRef: exercise.id,
      exerciseName: exercise.name,
      modality: exercise.modality,
      sets: [], // Managed by `sets` object in store
      restSeconds: exercise.restSeconds,
    };
    useWorkoutStore.setState((s) => {
      const existingSets = s.sets[exercise.id] || [];
      const newSets = [
        ...existingSets,
        {
          id: generateId(),
          setNumber: existingSets.length + 1,
          type: 'working' as const,
          kg: 0,
          reps: 0,
          done: false,
          timestamp: new Date().toISOString(),
        }
      ];
      // Since we just added a new exercise, we should set it as the current active one
      const newExercises = [...s.exercises, newLog];
      return {
        exercises: newExercises,
        sets: { ...s.sets, [exercise.id]: newSets },
        currentExercise: s.currentExercise || newLog,
        currentExerciseIndex: s.currentExercise ? s.currentExerciseIndex : 0
      };
    });
  }

  async function saveNote() {
    const existing = await db.exerciseNotes.where('exerciseId').equals(exercise.id).first();
    if (existing) {
      await db.exerciseNotes.update(existing.id, { content: note, updatedAt: isoDate() });
    } else {
      await db.exerciseNotes.add({
        id: generateId(),
        profileId: 'local',
        exerciseId: exercise.id,
        content: note,
        updatedAt: isoDate(),
      });
    }
    setNoteSaved(true);
    setTimeout(() => setNoteSaved(false), 2000);
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 pb-24">
      {/* Back */}
      <button
        onClick={() => router.back()}
        className="text-xs mb-4 flex items-center gap-1 min-h-[44px]"
        style={{ color: 'var(--text-muted)' }}
      >
        ← Back
      </button>

      {/* Header */}
      <div className="mb-6">
        <div className="flex flex-wrap gap-2 mb-2">
          <Badge variant={modalityVariant}>
            {exercise.modality === 'tytax'
              ? 'TYTAX'
              : exercise.modality === 'bodyweight'
              ? 'Bodyweight'
              : 'Kettlebell'}
          </Badge>
          {exercise.techniqueLevel && (
            <Badge
              variant={
                exercise.techniqueLevel === 'advanced'
                  ? 'danger'
                  : exercise.techniqueLevel === 'intermediate'
                  ? 'warning'
                  : 'success'
              }
            >
              {exercise.techniqueLevel}
            </Badge>
          )}
        </div>
        <h1
          className="text-2xl font-bold uppercase tracking-wide"
          style={{ fontFamily: 'var(--font-display)', color: 'var(--highlight)' }}
        >
          {exercise.name}
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          {exercise.pattern} &middot; {exercise.muscleGroup.replace(/_/g, ' ')}
          {exercise.isUnilateral ? ' (unilateral)' : ''}
        </p>
      </div>

      {/* Muscle impact */}
      <section
        className="mb-6 rounded-xl border p-4"
        style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
      >
        <h2
          className="text-xs font-semibold uppercase tracking-widest mb-3"
          style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-display)' }}
        >
          Muscle Impact
        </h2>
        <div className="space-y-2">
          {[...exercise.impact].sort((a, b) => b.score - a.score).map((m) => (
            <MuscleBar key={m.muscle} muscle={m.muscle} score={m.score} />
          ))}
        </div>
      </section>

      {/* KB weight tiers */}
      {exercise.recommendedWeightKg && (
        <section
          className="mb-6 rounded-xl border p-4"
          style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
        >
          <h2
            className="text-xs font-semibold uppercase tracking-widest mb-3"
            style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-display)' }}
          >
            Recommended Weight (kg)
          </h2>
          {(['male', 'female'] as const).map((gender) => (
            <div key={gender} className="mb-3">
              <p className="text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>
                {gender}
              </p>
              <div className="grid grid-cols-3 gap-2">
                {(['beginner', 'intermediate', 'advanced'] as const).map((lvl) => (
                  <div
                    key={lvl}
                    className="rounded-lg p-2 text-center border"
                    style={{
                      borderColor: 'var(--border-color)',
                      backgroundColor: 'var(--bg-secondary)',
                    }}
                  >
                    <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
                      {lvl}
                    </p>
                    <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                      {exercise.recommendedWeightKg![gender][lvl]} kg
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </section>
      )}

      {/* BW progression chain */}
      {chain && (
        <section
          className="mb-6 rounded-xl border p-4"
          style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
        >
          <h2
            className="text-xs font-semibold uppercase tracking-widest mb-1"
            style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-display)' }}
          >
            Progression Chain: {chain.name}
          </h2>
          <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
            Step {chainIndex + 1} of {chain.exercises.length}
          </p>
          <div className="flex gap-2 flex-wrap">
            {prevExercise && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push(`/exercises/${prevExercise.id}`)}
              >
                ← {prevExercise.name}
              </Button>
            )}
            {nextExercise && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => router.push(`/exercises/${nextExercise.id}`)}
              >
                {nextExercise.name} →
              </Button>
            )}
          </div>
        </section>
      )}

      {/* Notes */}
      <section
        className="mb-6 rounded-xl border p-4"
        style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
      >
        <h2
          className="text-xs font-semibold uppercase tracking-widest mb-2"
          style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-display)' }}
        >
          My Notes
        </h2>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Add coaching notes, cues, or personal records…"
          rows={3}
          className="w-full rounded-lg border p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-od-green-500/50"
          style={{
            backgroundColor: 'var(--bg-secondary)',
            borderColor: 'var(--border-color)',
            color: 'var(--text-primary)',
          }}
        />
        <Button variant="secondary" size="sm" className="mt-2" onClick={() => { void saveNote(); }}>
          {noteSaved ? 'Saved' : 'Save note'}
        </Button>
      </section>

      {/* Add to workout CTA */}
      <div className="fixed bottom-20 left-0 right-0 px-4 md:relative md:bottom-auto md:px-0">
        <Button
          fullWidth
          variant="primary"
          size="lg"
          disabled={!isWorkoutActive || alreadyInWorkout}
          onClick={handleAddToWorkout}
        >
          {!isWorkoutActive
            ? 'No active workout'
            : alreadyInWorkout
            ? 'Already in workout'
            : 'Add to Workout'}
        </Button>
      </div>
    </div>
  );
}
