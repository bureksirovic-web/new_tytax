/** Shared synthetic builders for the G3 store tests (not a test file). */
import type { Exercise, Modality, ProfileSettings, WorkoutLog } from '@/contracts/domain';
import { DEFAULT_PROFILE_SETTINGS } from '@/contracts/domain';
import type { Catalog } from '@/contracts/exercise-catalog';
import { buildWorkoutLog, sequentialIds, type SeedExerciseInput } from '@/contracts/fixtures';

export const NOW = new Date('2026-09-20T12:00:00.000Z');

export function ex(id: string, impact: Array<[string, number]>, over: Partial<Exercise> = {}): Exercise {
  return {
    id,
    name: id,
    modality: 'tytax' as Modality,
    muscleGroup: 'CHEST',
    pattern: 'push',
    isUnilateral: false,
    defaultSets: 3,
    defaultReps: '8-12',
    impact: impact.map(([muscle, score]) => ({ muscle, score })),
    ...over,
  };
}

export function settings(over: Partial<ProfileSettings> = {}): ProfileSettings {
  return { ...DEFAULT_PROFILE_SETTINGS, plateSetKg: [...DEFAULT_PROFILE_SETTINGS.plateSetKg], ...over };
}

const ids = sequentialIds('h');

export function log(daysAgo: number, exercises: SeedExerciseInput[], now = NOW): WorkoutLog {
  return buildWorkoutLog('p1', { daysAgo, exercises }, now, ids);
}

export function fakeCatalog(exercises: Exercise[]): Catalog {
  const byId = new Map(exercises.map((e) => [e.id, e]));
  return {
    chunks: ['tytax', 'bodyweight', 'kettlebell'],
    exercises,
    getById: (id) => byId.get(id),
    getByLegacyName: () => undefined,
    stations: [],
    attachments: [],
  };
}

export const lookupOf = (exercises: Exercise[]) => {
  const byId = new Map(exercises.map((e) => [e.id, e]));
  return (id: string) => byId.get(id);
};
