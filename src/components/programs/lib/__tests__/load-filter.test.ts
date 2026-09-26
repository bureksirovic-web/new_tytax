import { describe, expect, it } from 'vitest';
import type { Exercise, ProgramExercise, ProgramSession } from '@/contracts/domain';
import { ownershipFrom, stationIdOf } from '@/lib/programs/equipment';
import { filterSlotExercises, sortIdsByStation, DEFAULT_SLOT_FILTER } from '../slot-filter';
import { isValidReps, mergeSelection, moveExercise, removeExerciseAt, patchExerciseAt } from '../session-edit';

function ex(id: string, over: Partial<Exercise> = {}): Exercise {
  return { id, name: id, modality: 'tytax', muscleGroup: 'CHEST', pattern: '', isUnilateral: false, defaultSets: 3, defaultReps: '8-12', impact: [], ...over };
}

const FLAT = ex('flat', { pattern: 'Horizontal Press', impact: [{ muscle: 'Chest', score: 95 }, { muscle: 'Triceps', score: 65 }, { muscle: 'Front Delts', score: 35 }] });
const PULLDOWN = ex('pulldown', { pattern: 'Vertical Pull', muscleGroup: 'BACK_VERTICAL', impact: [{ muscle: 'lats', score: 95 }, { muscle: 'Biceps', score: 50 }] });
const SQUAT = ex('squat', { pattern: 'Squat', muscleGroup: 'QUADS', station: 'Smith Machine', impact: [{ muscle: 'Quads', score: 95 }, { muscle: 'Glutes', score: 70 }] });
const CRUNCH = ex('crunch', { pattern: 'Crunch', muscleGroup: 'CORE', impact: [{ muscle: 'Core', score: 95 }, { muscle: 'Quads', score: 92 }] });

function sess(name: string, id = name, isRest = false): ProgramSession {
  return { id, programId: 'p', name, dayIndex: 0, exercises: [], isRest };
}

describe('slot filter', () => {
  it('applies the smart context filter only when it is on', () => {
    const all = [FLAT, SQUAT, CRUNCH];
    const ctx = { kind: 'upper' as const, stations: [], own: ownershipFrom(undefined), favourites: new Set<string>(), requiredAttachments: () => [] };
    const base = { ...DEFAULT_SLOT_FILTER, modality: 'all' as const };
    expect(filterSlotExercises(all, base, ctx).map((e) => e.id)).toEqual(['flat', 'crunch']);
    expect(filterSlotExercises(all, { ...base, smart: false }, ctx).map((e) => e.id)).toEqual(['flat', 'squat', 'crunch']);
  });

  it('filters by muscle chip (BACK meta), station, favourites, ownership and text', () => {
    const all = [FLAT, PULLDOWN, SQUAT, ex('row', { muscleGroup: 'BACK_HORIZONTAL', name: 'Seated Cable Row' })];
    const stations = [{ id: 'smith', name: 'Smith Machine' }];
    const ctx = { kind: null, stations, own: ownershipFrom(undefined), favourites: new Set(['flat']), requiredAttachments: (e: Exercise) => (e.id === 'row' ? ['row-handle'] : []) };
    const base = { ...DEFAULT_SLOT_FILTER, modality: 'all' as const };
    expect(filterSlotExercises(all, { ...base, muscle: 'BACK' }, ctx).map((e) => e.id)).toEqual(['pulldown', 'row']);
    expect(filterSlotExercises(all, { ...base, stationId: 'smith' }, ctx).map((e) => e.id)).toEqual(['squat']);
    expect(filterSlotExercises(all, { ...base, favouritesOnly: true }, ctx).map((e) => e.id)).toEqual(['flat']);
    // Default ownership (no inventory) = lat-bar + ez-bar → the row handle is not owned.
    expect(filterSlotExercises(all, { ...base, ownedOnly: true }, ctx).map((e) => e.id)).toEqual(['flat', 'pulldown', 'squat']);
    expect(filterSlotExercises(all, { ...base, text: 'cable' }, ctx).map((e) => e.id)).toEqual(['row']);
    expect(stationIdOf(SQUAT, stations)).toBe('smith');
  });

  it('sorts selection by station, stable, station-less last', () => {
    const map = new Map([FLAT, SQUAT, PULLDOWN].map((e) => [e.id, e]));
    const lookup = (id: string) => map.get(id);
    const stations = [{ id: 'smith', name: 'Smith Machine' }];
    expect(sortIdsByStation(['flat', 'squat', 'pulldown'], lookup, stations)).toEqual(['squat', 'flat', 'pulldown']);
  });
});

describe('session edits', () => {
  const slot = (id: string, sets = 3): ProgramExercise => ({ exerciseId: id, exerciseName: id, modality: 'tytax', sets, reps: '8' });

  it('validates reps', () => {
    expect(['8', '8-12', '10/side', '10-15/side'].every(isValidReps)).toBe(true);
    // W2 spec change (G4-W2 refuter2 #3): free-text targets like 'abc'/'8 reps' are now valid; malformed numerics still are not.
    expect(['', '8-', '-8', '8--12', '   ', 'x'.repeat(25), 'a\u0000b'].some(isValidReps)).toBe(false);
  });

  it('keeps existing prescriptions, adds catalog defaults, follows selection order', () => {
    const merged = mergeSelection([slot('flat', 5), slot('old')], ['squat', 'flat', 'ghost'], (id) => (id === 'squat' ? SQUAT : undefined));
    expect(merged.map((m) => m.exerciseId)).toEqual(['squat', 'flat']);
    expect(merged[0]).toMatchObject({ sets: 3, reps: '8-12', exerciseName: 'squat' });
    expect(merged[1].sets).toBe(5);
  });

  it('a save keeps a repeated exercise and its interleaved arrangement (no data loss)', () => {
    const existing = [slot('a', 5), slot('b'), slot('a', 2)];
    // unchanged selection → exact same slots, both A's with their own sets
    expect(mergeSelection(existing, ['a', 'b'], () => undefined).map((e) => [e.exerciseId, e.sets])).toEqual([['a', 5], ['b', 3], ['a', 2]]);
    // new exercise appended after the kept ones
    expect(mergeSelection(existing, ['a', 'b', 'squat'], (id) => (id === 'squat' ? SQUAT : undefined)).map((e) => e.exerciseId)).toEqual(['a', 'b', 'a', 'squat']);
    // reordered (e.g. sort by station) → grouped in selection order, still both A's
    expect(mergeSelection(existing, ['b', 'a'], () => undefined).map((e) => [e.exerciseId, e.sets])).toEqual([['b', 3], ['a', 5], ['a', 2]]);
    // deselecting A drops both occurrences
    expect(mergeSelection(existing, ['b'], () => undefined).map((e) => e.exerciseId)).toEqual(['b']);
  });

  it('removes, moves and patches by index (duplicates stay distinct)', () => {
    const s: ProgramSession = { ...sess('A'), exercises: [slot('a'), slot('b'), slot('a')] };
    expect(removeExerciseAt(s, 2).exercises.map((e) => e.exerciseId)).toEqual(['a', 'b']);
    expect(moveExercise(s, 0, 1).exercises.map((e) => e.exerciseId)).toEqual(['b', 'a', 'a']);
    expect(patchExerciseAt(s, 2, { sets: 6 }).exercises.map((e) => e.sets)).toEqual([3, 3, 6]);
  });
});
