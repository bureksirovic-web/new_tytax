'use client';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db/dexie';
import type { PRRecord } from '@/types/workout';

export function usePR(exerciseId: string) {
  const prs = useLiveQuery<PRRecord[]>(
    () => db.prRecords.where('exerciseId').equals(exerciseId).toArray(),
    [exerciseId]
  );

  const isLoading = prs === undefined;
  const records = prs ?? [];

  const weightPR = records
    .filter((p) => p.prType === 'weight')
    .reduce<number>((best, p) => Math.max(best, p.value), 0);

  const repsPR = records
    .filter((p) => p.prType === 'reps')
    .reduce<number>((best, p) => Math.max(best, p.value), 0);

  const volumePR = records
    .filter((p) => p.prType === 'volume')
    .reduce<number>((best, p) => Math.max(best, p.value), 0);

  return {
    prs: records,
    bestWeight: weightPR,
    bestReps: repsPR,
    bestVolume: volumePR,
    isLoading,
  };
}

export function usePRCheck(exerciseId: string, weight: number, reps: number) {
  const { bestWeight, bestReps, bestVolume, isLoading } = usePR(exerciseId);

  if (isLoading || (weight === 0 && reps === 0)) {
    return { isPR: false, prType: null as null };
  }

  const volume = weight * reps;

  if (weight > bestWeight) return { isPR: true, prType: 'weight' as const };
  if (reps > bestReps) return { isPR: true, prType: 'reps' as const };
  if (volume > bestVolume) return { isPR: true, prType: 'volume' as const };

  return { isPR: false, prType: null as null };
}
