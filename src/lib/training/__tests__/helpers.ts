/** Shared synthetic fixtures for the training tests (no real user data). */
import type { Exercise, MuscleImpact, WorkoutLog } from '@/contracts/domain';
import type { ExerciseLookup } from '@/contracts/training';
import { buildWorkoutLog, sequentialIds, type SeedExerciseInput, type SeedLogInput } from '@/contracts/fixtures';

export const HOUR = 3_600_000;
export const DAY = 86_400_000;

function ex(id: string, impact: MuscleImpact[]): Exercise {
  return {
    id,
    name: id,
    modality: 'tytax',
    muscleGroup: 'CHEST',
    pattern: 'test',
    isUnilateral: false,
    defaultSets: 3,
    defaultReps: '8-12',
    impact,
  };
}

/** press: Chest 100, Triceps 50 · curl: Biceps 100 · row: Lats 80, Mid Back 40 · calf: Gastrocnemius 80, Soleus 60 · run: Cardio 50 */
export const TEST_EXERCISES: Record<string, Exercise> = {
  press: ex('press', [
    { muscle: 'Chest', score: 100 },
    { muscle: 'Triceps', score: 50 },
  ]),
  curl: ex('curl', [{ muscle: 'Biceps', score: 100 }]),
  row: ex('row', [
    { muscle: 'Lats', score: 80 },
    { muscle: 'Mid Back', score: 40 },
  ]),
  calf: ex('calf', [
    { muscle: 'Gastrocnemius', score: 80 },
    { muscle: 'Soleus', score: 60 },
  ]),
  run: ex('run', [{ muscle: 'Cardio', score: 50 }]),
};

export const lookup: ExerciseLookup = (id) => TEST_EXERCISES[id];

let counter = 0;

/**
 * A finished log that ENDS exactly `hoursAgo` before `now` (duration 0, so
 * startedAt = finishedAt), with an explicit calendar `date` when given.
 */
export function logEndingAt(
  now: Date,
  hoursAgo: number,
  exercises: SeedExerciseInput[],
  extra: Partial<SeedLogInput> & { date?: string } = {},
): WorkoutLog {
  counter += 1;
  const { date, ...seed } = extra;
  const log = buildWorkoutLog(
    'p1',
    { daysAgo: hoursAgo / 24, durationSeconds: 0, exercises, ...seed },
    now,
    sequentialIds(`t${counter}`),
  );
  return date ? { ...log, date } : log;
}

/** `n` done working sets of kg × reps. */
export function sets(n: number, kg = 50, reps = 10): SeedExerciseInput['sets'] {
  return Array.from({ length: n }, () => ({ kg, reps }));
}
