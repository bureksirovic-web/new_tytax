import { describe, expect, it } from 'vitest';
import type { Exercise, ProgramExercise, ProgramSession } from '@/contracts/domain';
import { focusGroup, liveLoad, pushPull } from '../load';
import {
  contextAllows,
  filterSlotExercises,
  hiddenChips,
  ownershipFrom,
  ownsExercise,
  sessionKind,
  sortIdsByStation,
  stationIdOf,
  DEFAULT_SLOT_FILTER,
} from '../slot-filter';
import { isValidReps, mergeSelection, moveExercise, removeExerciseAt, patchExerciseAt } from '../session-edit';

function ex(id: string, over: Partial<Exercise> = {}): Exercise {
  return { id, name: id, modality: 'tytax', muscleGroup: 'CHEST', pattern: '', isUnilateral: false, defaultSets: 3, defaultReps: '8-12', impact: [], ...over };
}

const FLAT = ex('flat', { pattern: 'Horizontal Press', impact: [{ muscle: 'Chest', score: 95 }, { muscle: 'Triceps', score: 65 }, { muscle: 'Front Delts', score: 35 }] });
const INCLINE = ex('incline', { pattern: 'Horizontal Press', impact: [{ muscle: 'Upper Chest', score: 95 }, { muscle: 'Front Delts', score: 65 }, { muscle: 'Triceps', score: 35 }] });
const OHP = ex('ohp', { pattern: 'Seated Shoulder Press', muscleGroup: 'SHOULDERS', impact: [{ muscle: 'Front Delts', score: 95 }] });
const PULLDOWN = ex('pulldown', { pattern: 'Vertical Pull', muscleGroup: 'BACK_VERTICAL', impact: [{ muscle: 'lats', score: 95 }, { muscle: 'Biceps', score: 50 }] });
const SQUAT = ex('squat', { pattern: 'Squat', muscleGroup: 'QUADS', station: 'Smith Machine', impact: [{ muscle: 'Quads', score: 95 }, { muscle: 'Glutes', score: 70 }] });
const CRUNCH = ex('crunch', { pattern: 'Crunch', muscleGroup: 'CORE', impact: [{ muscle: 'Core', score: 95 }, { muscle: 'Quads', score: 92 }] });
const KICK = ex('kick', { pattern: 'Hip Extension', muscleGroup: 'GLUTES', isUnilateral: true, impact: [{ muscle: 'Glutes', score: 90 }] });

describe('live load / focus / push:pull', () => {
  it('matches the P18 hand-check for flat + incline', () => {
    const byGroup = Object.fromEntries(liveLoad([FLAT, INCLINE]).map((g) => [g.group, g]));
    // Chest 95 + 95 ("Upper Chest" contains chest) = 190 → 190/300 = 63.33 %
    expect(byGroup.CHEST.score).toBe(190);
    expect(byGroup.CHEST.pct).toBeCloseTo(63.33, 2);
    // Triceps 65 + 35 = 100 → 33.3 %; Shoulders (Front Delts) 35 + 65 = 100 → 33.3 %
    expect(byGroup.TRICEPS.score).toBe(100);
    expect(byGroup.SHOULDERS.pct).toBeCloseTo(33.33, 2);
    expect(focusGroup([FLAT, INCLINE])).toBe('CHEST');
    expect(focusGroup([])).toBeNull();
  });

  it('doubles unilateral exercises, matches case-insensitively and caps at 100 %', () => {
    const glutes = liveLoad([KICK]).find((g) => g.group === 'GLUTES');
    expect(glutes?.score).toBe(180); // 90 × 2
    expect(liveLoad([PULLDOWN]).find((g) => g.group === 'BACK')?.score).toBe(95); // "lats"
    expect(liveLoad([KICK, KICK]).find((g) => g.group === 'GLUTES')?.pct).toBe(100); // 360 → capped
  });

  it('computes push:pull as legacy (P17 hand-check 3:1 → imbalanced)', () => {
    expect(pushPull([FLAT, INCLINE, OHP, PULLDOWN])).toEqual({ push: 3, pull: 1, ratio: 3, imbalanced: true });
    expect(pushPull([FLAT, PULLDOWN])).toMatchObject({ push: 1, pull: 1, imbalanced: false });
    expect(pushPull([FLAT]).ratio).toBe(1); // pull 0 → ratio = push
  });
});

function sess(name: string, id = name, isRest = false): ProgramSession {
  return { id, programId: 'p', name, dayIndex: 0, exercises: [], isRest };
}

describe('session kind and smart filter', () => {
  it('derives kind from name (en/hr), then split+position', () => {
    const custom = { splitType: 'custom' as const, sessions: [] };
    expect(sessionKind(custom, sess('Upper A'))).toBe('upper');
    expect(sessionKind(custom, sess('Donji B'))).toBe('lower');
    expect(sessionKind(custom, sess('Povlačenje A'))).toBe('pull');
    expect(sessionKind(custom, sess('Rest', 'r', true))).toBeNull();
    const renamed = [sess('Monday', 'a'), sess('Tuesday', 'b'), sess('Wed', 'c')];
    expect(sessionKind({ splitType: 'push_pull_legs', sessions: renamed }, renamed[1])).toBe('pull');
    expect(sessionKind(custom, sess('Monday'))).toBeNull();
  });

  it('excludes by primary muscle per kind; core-primary always allowed', () => {
    expect(contextAllows('upper', SQUAT)).toBe(false);
    expect(contextAllows('upper', FLAT)).toBe(true);
    expect(contextAllows('lower', FLAT)).toBe(false);
    expect(contextAllows('lower', SQUAT)).toBe(true);
    expect(contextAllows('pull', FLAT)).toBe(false);
    expect(contextAllows('pull', PULLDOWN)).toBe(true);
    expect(contextAllows('upper', CRUNCH)).toBe(true); // Quads 92 primary, but Core primary wins
    expect(contextAllows(null, SQUAT)).toBe(true);
    expect([...hiddenChips('upper')].sort()).toEqual(['CALVES', 'GLUTES', 'HAMSTRINGS', 'QUADS']);
    expect(hiddenChips('lower').has('BACK')).toBe(true);
    expect(hiddenChips('pull').has('CHEST')).toBe(true);
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

  it('respects a stored inventory (attachments and stations)', () => {
    const own = ownershipFrom({ attachmentIds: ['rope'], stationIds: ['smith'] });
    expect(ownsExercise(['rope'], 'smith', own)).toBe(true);
    expect(ownsExercise(['lat-bar'], 'smith', own)).toBe(false); // defaults do not apply once set up
    expect(ownsExercise([], 'back-upper', own)).toBe(false);
    expect(ownsExercise([], undefined, own)).toBe(true);
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
    expect(['', 'abc', '8-', '-8', '8 reps'].some(isValidReps)).toBe(false);
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
