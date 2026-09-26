import { describe, it, expect } from 'vitest';
import type { SessionExercise } from '@/contracts/domain';
import { SWAP_LIMIT, isNameSearch, swapCandidates } from '../picker-swap';
import { ex } from './picker-helpers';

const target = ex('bench', 'Bench Press', { muscleGroup: 'CHEST', pattern: 'push' });
const ALL = [
  target,
  ex('fly', 'Cable Fly', { muscleGroup: 'CHEST', pattern: 'fly' }),
  ex('incline', 'Incline Press', { muscleGroup: 'CHEST', pattern: 'push' }),
  ex('ohp', 'Overhead Press', { muscleGroup: 'SHOULDERS', pattern: 'push' }),
  ex('squat', 'Squat', { muscleGroup: 'QUADS', pattern: 'squat' }),
  ex('dip', 'Dip', { muscleGroup: 'CHEST', pattern: 'push', modality: 'bodyweight' }),
];
const se: SessionExercise = { uid: 'u1', exerciseId: 'bench', exerciseName: 'Bench Press', modality: 'tytax', sets: [] };
const all = () => true;
const ids = (list: { id: string }[]) => list.map((e) => e.id);

describe('swapCandidates', () => {
  it('ranks muscle+pattern, then muscle, then pattern; excludes the target and unrelated', () => {
    // both: Dip, Incline Press (A-Z) | muscle only: Cable Fly | pattern only: Overhead Press
    const out = swapCandidates({ exercise: se, catalogExercises: ALL, target, query: '', isAvailable: all });
    expect(ids(out)).toEqual(['dip', 'incline', 'fly', 'ohp']);
  });

  it('applies availability', () => {
    const out = swapCandidates({
      exercise: se,
      catalogExercises: ALL,
      target,
      query: '',
      isAvailable: (e) => e.modality !== 'bodyweight',
    });
    expect(ids(out)).toEqual(['incline', 'fly', 'ohp']);
  });

  it('2 chars stay on similarity; 3+ chars switch to name search', () => {
    expect(isNameSearch('sq')).toBe(false);
    expect(isNameSearch(' squ ')).toBe(true);
    expect(ids(swapCandidates({ exercise: se, catalogExercises: ALL, target, query: 'sq', isAvailable: all }))).toEqual([
      'dip',
      'incline',
      'fly',
      'ohp',
    ]);
    expect(ids(swapCandidates({ exercise: se, catalogExercises: ALL, target, query: 'SQU', isAvailable: all }))).toEqual(['squat']);
    // "press" never returns the target itself
    expect(ids(swapCandidates({ exercise: se, catalogExercises: ALL, target, query: 'press', isAvailable: all }))).toEqual([
      'incline',
      'ohp',
    ]);
  });

  it('caps at 30 by default', () => {
    const many = Array.from({ length: 45 }, (_, i) => ex(`c${i}`, `Chest ${String(i).padStart(2, '0')}`));
    const out = swapCandidates({ exercise: se, catalogExercises: [target, ...many], target, query: '', isAvailable: all });
    expect(SWAP_LIMIT).toBe(30);
    expect(out).toHaveLength(30);
    expect(out[0].id).toBe('c0');
  });

  it('unknown target (custom exercise): nothing until a name search, never itself', () => {
    const custom: SessionExercise = { ...se, exerciseId: 'custom-1', exerciseName: 'My Press' };
    const withSelf = [...ALL, ex('custom-1', 'My Press')];
    expect(swapCandidates({ exercise: custom, catalogExercises: withSelf, target: undefined, query: '', isAvailable: all })).toEqual([]);
    expect(
      ids(swapCandidates({ exercise: custom, catalogExercises: withSelf, target: undefined, query: 'press', isAvailable: all })),
    ).toEqual(['bench', 'incline', 'ohp']);
  });
});
