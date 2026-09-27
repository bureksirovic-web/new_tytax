import type { Exercise, MuscleGroup, Modality } from '@/contracts/domain';
import type { Catalog } from '@/contracts/exercise-catalog';

export function ex(
  id: string,
  name: string,
  over: Partial<Exercise> & { muscleGroup?: MuscleGroup; modality?: Modality } = {},
): Exercise {
  return {
    id,
    name,
    modality: 'tytax',
    muscleGroup: 'CHEST',
    pattern: 'push',
    isUnilateral: false,
    defaultSets: 3,
    defaultReps: '8-12',
    impact: [],
    ...over,
  };
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
