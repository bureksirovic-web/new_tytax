'use client';
import { useCallback } from 'react';
import { useWorkoutStore } from '@/stores/workout-store';
import { db } from '@/lib/db/dexie';
import { generateId, isoDate } from '@/lib/utils';

export function useWorkout() {
  const store = useWorkoutStore();

  const finishAndSave = useCallback(async () => {
    const now = new Date();
    const startedAt = store.startedAt ?? now.toISOString();
    const durationSeconds = Math.round(
      (now.getTime() - new Date(startedAt).getTime()) / 1000
    );

    const totalVolumeKg = store.exercises.reduce((total, ex) =>
      total + ex.sets.reduce((s, set) => s + (set.done ? set.kg * set.reps : 0), 0), 0
    );
    const totalSets = store.exercises.reduce(
      (total, ex) => total + ex.sets.filter((s) => s.done).length, 0
    );
    const modalitiesUsed = [...new Set(store.exercises.map((e) => e.modality))];

    const log = {
      id: generateId(),
      profileId: 'local',
      programId: store.programId,
      sessionName: store.sessionName || 'Quick Workout',
      date: isoDate(),
      startedAt,
      finishedAt: now.toISOString(),
      durationSeconds,
      exercises: store.exercises,
      totalVolumeKg,
      totalSets,
      prCount: store.exercises.reduce(
        (n, ex) => n + ex.sets.filter((s) => s.isPersonalRecord).length, 0
      ),
      modalitiesUsed,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      syncedAt: undefined,
    };

    await db.workoutLogs.add(log);
    store.finishWorkout();
  }, [store]);

  return {
    ...store,
    finishAndSave,
  };
}
