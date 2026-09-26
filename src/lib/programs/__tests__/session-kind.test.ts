import { describe, expect, it } from 'vitest';
import type { Exercise, ProgramSession } from '@/contracts/domain';
import { MUSCLE_CHIPS, hiddenMuscleChips, sessionContextAllows, sessionKind, type SessionWithKind } from '../session-kind';

function ex(id: string, over: Partial<Exercise> = {}): Exercise {
  return { id, name: id, modality: 'tytax', muscleGroup: 'CHEST', pattern: '', isUnilateral: false, defaultSets: 3, defaultReps: '8-12', impact: [], ...over };
}

const FLAT = ex('flat', { pattern: 'Horizontal Press', impact: [{ muscle: 'Chest', score: 95 }, { muscle: 'Triceps', score: 65 }, { muscle: 'Front Delts', score: 35 }] });
const PULLDOWN = ex('pulldown', { pattern: 'Vertical Pull', muscleGroup: 'BACK_VERTICAL', impact: [{ muscle: 'lats', score: 95 }, { muscle: 'Biceps', score: 50 }] });
const SQUAT = ex('squat', { pattern: 'Squat', muscleGroup: 'QUADS', impact: [{ muscle: 'Quads', score: 95 }, { muscle: 'Glutes', score: 70 }] });
const CRUNCH = ex('crunch', { pattern: 'Crunch', muscleGroup: 'CORE', impact: [{ muscle: 'Core', score: 95 }, { muscle: 'Quads', score: 92 }] });

function sess(name: string, id = name, isRest = false): ProgramSession {
  return { id, programId: 'p', name, dayIndex: 0, exercises: [], isRest };
}

describe('sessionKind (G4-15)', () => {
  const custom = { splitType: 'custom' as const, sessions: [] };

  it('derives kind from name (en/hr), then split+position', () => {
    expect(sessionKind(custom, sess('Upper A'))).toBe('upper');
    expect(sessionKind(custom, sess('Donji B'))).toBe('lower');
    expect(sessionKind(custom, sess('Povlačenje A'))).toBe('pull');
    expect(sessionKind(custom, sess('Gornji A'))).toBe('upper');
    expect(sessionKind(custom, sess('Rest', 'r', true))).toBeNull();
    const renamed = [sess('Monday', 'a'), sess('Tuesday', 'b'), sess('Wed', 'c')];
    // push_pull_legs pattern [push, pull, legs]; 'b' is training day 1 → pull
    expect(sessionKind({ splitType: 'push_pull_legs', sessions: renamed }, renamed[1])).toBe('pull');
    expect(sessionKind(custom, sess('Monday'))).toBeNull();
  });

  it('counts position among training days only, wrapping the split pattern', () => {
    const days = [sess('Mon', 'a'), sess('Rest', 'r', true), sess('Tue', 'b'), sess('Wed', 'c')];
    const program = { splitType: 'upper_lower' as const, sessions: days };
    // training days a, b, c → indices 0, 1, 2 (rest skipped); pattern [upper, lower]: b → 1 % 2 = 1 → lower, c → 2 % 2 = 0 → upper
    expect(sessionKind(program, days[2])).toBe('lower');
    expect(sessionKind(program, days[3])).toBe('upper');
    // a session that is not in the program has no position
    expect(sessionKind(program, sess('Thu', 'z'))).toBeNull();
  });

  it('prefers a stored kind, ignoring an invalid one', () => {
    const stored: SessionWithKind = { ...sess('Upper A'), kind: 'legs' };
    expect(sessionKind(custom, stored)).toBe('legs');
    const bogus = { ...sess('Upper A'), kind: 'arms' } as unknown as SessionWithKind;
    expect(sessionKind(custom, bogus)).toBe('upper');
  });
});

describe('smart filter (G4-16)', () => {
  it('excludes by primary muscle per kind; core-primary always allowed', () => {
    expect(sessionContextAllows('upper', SQUAT)).toBe(false);
    expect(sessionContextAllows('upper', FLAT)).toBe(true);
    expect(sessionContextAllows('lower', FLAT)).toBe(false);
    expect(sessionContextAllows('lower', SQUAT)).toBe(true);
    expect(sessionContextAllows('pull', FLAT)).toBe(false);
    expect(sessionContextAllows('pull', PULLDOWN)).toBe(true);
    expect(sessionContextAllows('upper', CRUNCH)).toBe(true); // Quads 92 primary, but Core primary wins
    expect(sessionContextAllows(null, SQUAT)).toBe(true);
    expect(sessionContextAllows('full', SQUAT)).toBe(true);
  });

  it('hides chips per kind (legacy L4552-4565)', () => {
    expect([...hiddenMuscleChips('upper')].sort()).toEqual(['CALVES', 'GLUTES', 'HAMSTRINGS', 'QUADS']);
    expect([...hiddenMuscleChips('push')].sort()).toEqual(['CALVES', 'GLUTES', 'HAMSTRINGS', 'QUADS']);
    expect([...hiddenMuscleChips('pull')].sort()).toEqual(['CALVES', 'CHEST', 'QUADS', 'TRICEPS']);
    expect(hiddenMuscleChips('lower').has('BACK')).toBe(true);
    expect(hiddenMuscleChips('legs').size).toBe(8); // CHEST, BACK, BACK_VERTICAL, BACK_HORIZONTAL, SHOULDERS, BICEPS, TRICEPS, FOREARMS_GRIP
    expect(hiddenMuscleChips('full').size).toBe(0); // full hides nothing
    expect(hiddenMuscleChips(null).size).toBe(0); // no kind hides nothing
    expect(MUSCLE_CHIPS).toHaveLength(14); // ALL + BACK + 12 muscle groups
  });
});
