'use client';
import { useCallback, useRef, useState } from 'react';
import type { Exercise, SessionExercise, SetEntry } from '@/contracts/domain';
import { useCatalog } from '@/hooks/use-exercises';
import { useWorkout } from '@/hooks/use-workout';
import { useWorkoutStore } from '@/stores/workout-store';
import { useRestTimerStore } from '@/stores/rest-timer-store';
import { SwapSheet } from '@/components/workout/swap-sheet';
import { SetRow } from './set-row';
import { ExerciseCardHeader } from './exercise-card-header';
import { ExerciseCardFooter } from './exercise-card-footer';
import {
  DONE_VIBRATION_MS,
  buildWarmups,
  canToggleDone,
  hasWarmups,
  heaviestWorkingKg,
  nextSetId,
  restAlerts,
  restSecondsFor,
  setNumbers,
} from './set-rules';

export interface SessionExerciseCardProps {
  exercise: SessionExercise;
  isFirst: boolean;
  isLast: boolean;
}

/**
 * One exercise of the running workout: header (video, swap, reorder, remove),
 * its set rows and add-set / add-warm-up. Keyed by `uid`, so the same
 * exercise can appear twice. Marking a set done starts the rest timer
 * (exercise → profile → 90 s), unlocks audio, vibrates 50 ms and focuses the
 * next set's kg input.
 */
export function SessionExerciseCard({ exercise, isFirst, isLast }: SessionExerciseCardProps) {
  const { settings, swapExercise } = useWorkout();
  const { catalog } = useCatalog();
  const moveExercise = useWorkoutStore((s) => s.moveExercise);
  const removeExercise = useWorkoutStore((s) => s.removeExercise);
  const addSet = useWorkoutStore((s) => s.addSet);
  const updateSet = useWorkoutStore((s) => s.updateSet);
  const removeSet = useWorkoutStore((s) => s.removeSet);
  const toggleSetDone = useWorkoutStore((s) => s.toggleSetDone);
  const prependWarmups = useWorkoutStore((s) => s.prependWarmups);
  const startRest = useRestTimerStore((s) => s.start);
  const [swapping, setSwapping] = useState(false);
  const kgInputs = useRef(new Map<string, HTMLInputElement>());

  const { uid, modality, sets } = exercise;
  const headingId = `exercise-${uid}`;
  const numbers = setNumbers(sets);
  const workingKg = heaviestWorkingKg(sets);

  const kgRefFor = useCallback(
    (setId: string) => (el: HTMLInputElement | null) => {
      if (el) kgInputs.current.set(setId, el);
      else kgInputs.current.delete(setId);
    },
    [],
  );

  function toggleDone(set: SetEntry) {
    if (!canToggleDone(set, modality)) return;
    toggleSetDone(uid, set.id);
    if (set.done) return; // undo: no timer, no focus move
    startRest(restSecondsFor(exercise, settings));
    const alerts = restAlerts();
    alerts.unlock();
    alerts.vibrate([DONE_VIBRATION_MS]);
    const next = nextSetId(sets, set.id);
    if (next) kgInputs.current.get(next)?.focus();
  }

  function addWarmup() {
    const warmups = buildWarmups(workingKg, settings);
    if (warmups.length > 0) prependWarmups(uid, warmups);
  }

  function pickSwap(picked: Exercise) {
    setSwapping(false);
    void swapExercise(uid, picked);
  }

  return (
    <section
      data-testid="session-exercise"
      data-exercise-id={exercise.exerciseId}
      data-uid={uid}
      aria-labelledby={headingId}
      className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] p-3"
    >
      <ExerciseCardHeader
        exercise={exercise}
        catalogExercise={catalog?.getById(exercise.exerciseId)}
        headingId={headingId}
        isFirst={isFirst}
        isLast={isLast}
        onMove={(direction) => moveExercise(uid, direction)}
        onRemove={() => removeExercise(uid)}
        onSwap={() => setSwapping(true)}
      />

      <ol className="space-y-1.5" aria-labelledby={headingId}>
        {sets.map((set, i) => (
          <SetRow
            key={set.id}
            set={set}
            number={numbers[i]}
            modality={modality}
            units={settings.units}
            kgRef={kgRefFor(set.id)}
            onChange={(patch) => updateSet(uid, set.id, patch)}
            onToggleDone={() => toggleDone(set)}
            onRemove={() => removeSet(uid, set.id)}
          />
        ))}
      </ol>

      <ExerciseCardFooter
        exerciseName={exercise.exerciseName}
        onAddSet={() => addSet(uid)}
        onAddWarmup={addWarmup}
        canAddWarmup={workingKg > 0 && !hasWarmups(sets)}
      />

      {swapping && <SwapSheet exercise={exercise} onClose={() => setSwapping(false)} onPick={pickSwap} />}
    </section>
  );
}
