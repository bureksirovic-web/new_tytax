import { TYTAX_EXERCISES } from './tytax/exercises';
import { BODYWEIGHT_EXERCISES } from './bodyweight/exercises';
import { KB_EXERCISES } from './kettlebell/exercises';
import type { Exercise } from '@/types/exercise';

export { TYTAX_EXERCISES, BODYWEIGHT_EXERCISES, KB_EXERCISES };

export const ALL_EXERCISES: Exercise[] = [
  ...TYTAX_EXERCISES,
  ...BODYWEIGHT_EXERCISES,
  ...KB_EXERCISES,
];

export function findExerciseById(id: string): Exercise | undefined {
  return ALL_EXERCISES.find(e => e.id === id);
}
