'use client';
import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import { db } from '@/lib/db/dexie';
import { computeACWR } from '@/lib/analytics/acwr';
import { computeWeeklyVolume, volumeByMuscle } from '@/lib/analytics/volume';
import { getE1RMProgression, getBestLifts } from '@/lib/analytics/pr-tracker';
import { analyzeMuscleGaps } from '@/lib/analytics/gap-analysis';
import { computeVolumeParity } from '@/lib/analytics/volume-parity';
import { computeKineticImpact } from '@/lib/analytics/kinetic-impact';

export function useAnalytics(windowDays = 90) {
  const logs = useLiveQuery(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - windowDays);
    return db.workoutLogs
      .where('date')
      .aboveOrEqual(cutoff.toISOString().slice(0, 10))
      .sortBy('date');
  }, [windowDays]);

  const acwr = useMemo(() => (logs ? computeACWR(logs) : []), [logs]);
  const weeklyVolume = useMemo(() => (logs ? computeWeeklyVolume(logs) : []), [logs]);
  const muscleGaps = useMemo(() => (logs ? analyzeMuscleGaps(logs) : []), [logs]);
  const bestLifts = useMemo(() => (logs ? getBestLifts(logs) : {}), [logs]);
  const muscleVolume = useMemo(() => (logs ? volumeByMuscle(logs) : {}), [logs]);

  const volumeParity = useMemo(() => (logs ? computeVolumeParity(logs, 30) : []), [logs]);
  const kineticImpact = useMemo(() => (logs ? computeKineticImpact(logs, 28) : null), [logs]);

  return {
    logs: logs ?? [],
    acwr,
    weeklyVolume,
    muscleGaps,
    bestLifts,
    muscleVolume,
    volumeParity,
    kineticImpact,
    isLoading: logs === undefined,
  };
}

export function useExerciseAnalytics(exerciseId: string) {
  const logs = useLiveQuery(() => db.workoutLogs.toArray(), []);
  const e1rmProgression = useMemo(
    () => (logs ? getE1RMProgression(logs, exerciseId) : []),
    [logs, exerciseId]
  );
  return { e1rmProgression, isLoading: logs === undefined };
}
