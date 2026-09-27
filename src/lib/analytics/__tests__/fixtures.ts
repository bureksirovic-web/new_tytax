/** Synthetic WorkoutLog builder for analytics tests (new contract shape). */
import type { MuscleImpact, SetType, WorkoutLog } from '@/contracts/domain';

export interface FixtureSet {
  kg: number;
  reps: number;
  /** Default true. */
  done?: boolean;
  /** Default 'working'. */
  type?: SetType;
  /** Seconds held: makes it a time set (F2). Omitted by default. */
  durationSeconds?: number;
}

export interface FixtureExercise {
  id: string;
  sets: FixtureSet[];
  impact?: MuscleImpact[];
}

let seq = 0;

/** A log on local calendar day `date` ('YYYY-MM-DD'). */
export function makeLog(date: string, exercises: FixtureExercise[], extra: Partial<WorkoutLog> = {}): WorkoutLog {
  seq += 1;
  const stamp = `${date}T10:00:00.000Z`;
  return {
    id: `log-${seq}`,
    profileId: 'test',
    sessionName: 'Test',
    date,
    startedAt: stamp,
    finishedAt: stamp,
    durationSeconds: 3600,
    exercises: exercises.map((ex, i) => ({
      uid: `u-${seq}-${i}`,
      exerciseId: ex.id,
      exerciseName: `Exercise ${ex.id}`,
      modality: 'tytax',
      sets: ex.sets.map((s, si) => ({
        id: `s-${seq}-${i}-${si}`,
        type: s.type ?? 'working',
        kg: s.kg,
        reps: s.reps,
        done: s.done ?? true,
        ...(s.durationSeconds !== undefined ? { durationSeconds: s.durationSeconds } : {}),
      })),
      muscleImpactSnapshot: ex.impact ?? [],
    })),
    totalVolumeKg: 0,
    totalSets: 0,
    prCount: 0,
    modalitiesUsed: ['tytax'],
    createdAt: stamp,
    updatedAt: stamp,
    ...extra,
  };
}

/** One exercise with one done working set of `kg` × 1 (volume = kg). */
export function volumeLog(date: string, kg: number, muscle = 'Chest', id = 'test_ex'): WorkoutLog {
  return makeLog(date, [{ id, sets: [{ kg, reps: 1 }], impact: [{ muscle, score: 100 }] }]);
}

/** Local calendar day `days` before `now`, 'YYYY-MM-DD'. */
export function daysBefore(now: Date, days: number): string {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
