import { describe, expect, it } from 'vitest';
import type { Exercise } from '@/contracts/domain';
import { LOAD_CAP, LOAD_GROUPS, liveLoadByGroup, muscleInGroup, projectedFocus, pushPullRatio } from '../load';

function ex(id: string, over: Partial<Exercise> = {}): Exercise {
  return { id, name: id, modality: 'tytax', muscleGroup: 'CHEST', pattern: '', isUnilateral: false, defaultSets: 3, defaultReps: '8-12', impact: [], ...over };
}

const FLAT = ex('flat', { pattern: 'Horizontal Press', impact: [{ muscle: 'Chest', score: 95 }, { muscle: 'Triceps', score: 65 }, { muscle: 'Front Delts', score: 35 }] });
const INCLINE = ex('incline', { pattern: 'Horizontal Press', impact: [{ muscle: 'Upper Chest', score: 95 }, { muscle: 'Front Delts', score: 65 }, { muscle: 'Triceps', score: 35 }] });
const OHP = ex('ohp', { pattern: 'Seated Shoulder Press', muscleGroup: 'SHOULDERS', impact: [{ muscle: 'Front Delts', score: 95 }] });
const PULLDOWN = ex('pulldown', { pattern: 'Vertical Pull', muscleGroup: 'BACK_VERTICAL', impact: [{ muscle: 'lats', score: 95 }, { muscle: 'Biceps', score: 50 }] });
const KICK = ex('kick', { pattern: 'Hip Extension', muscleGroup: 'GLUTES', isUnilateral: true, impact: [{ muscle: 'Glutes', score: 90 }] });

describe('liveLoadByGroup / projectedFocus / pushPullRatio (G4-16)', () => {
  it('matches the P18 hand-check for flat + incline', () => {
    const byGroup = Object.fromEntries(liveLoadByGroup([FLAT, INCLINE]).map((g) => [g.group, g]));
    // Chest 95 + 95 ("Upper Chest" contains chest) = 190 → 190/300 = 63.33 %
    expect(byGroup.CHEST.score).toBe(190);
    expect(byGroup.CHEST.pct).toBeCloseTo(63.33, 2);
    // Triceps 65 + 35 = 100; Shoulders (Front Delts) 35 + 65 = 100 → 100/300 = 33.33 %
    expect(byGroup.TRICEPS.score).toBe(100);
    expect(byGroup.SHOULDERS.pct).toBeCloseTo(33.33, 2);
    expect(projectedFocus([FLAT, INCLINE])).toBe('CHEST');
    expect(projectedFocus([])).toBeNull();
  });

  it('returns every group in LOAD_GROUPS order, zero for an empty list', () => {
    const empty = liveLoadByGroup([]);
    expect(empty.map((g) => g.group)).toEqual([...LOAD_GROUPS]);
    expect(empty.every((g) => g.score === 0 && g.pct === 0)).toBe(true);
    expect(LOAD_GROUPS).toHaveLength(10); // CHEST, BACK, SHOULDERS, BICEPS, TRICEPS, QUADS, HAMSTRINGS, GLUTES, CALVES, CORE
    expect(LOAD_CAP).toBe(300); // legacy visual cap
  });

  it('doubles unilateral exercises, matches case-insensitively and caps at 100 %', () => {
    expect(liveLoadByGroup([KICK]).find((g) => g.group === 'GLUTES')?.score).toBe(180); // 90 × 2
    expect(liveLoadByGroup([PULLDOWN]).find((g) => g.group === 'BACK')?.score).toBe(95); // lowercase "lats" 95 counts for BACK; Biceps 50 does not
    expect(liveLoadByGroup([KICK, KICK]).find((g) => g.group === 'GLUTES')?.pct).toBe(100); // 360/300 = 120 % → capped at 100
  });

  it('feeds one muscle into two groups where legacy does', () => {
    expect(muscleInGroup('Spinal Erectors', 'BACK')).toBe(true);
    expect(muscleInGroup('Spinal Erectors', 'CORE')).toBe(true);
    expect(muscleInGroup('  LATS ', 'BACK')).toBe(true);
    expect(muscleInGroup('Brachialis', 'BICEPS')).toBe(true);
    expect(muscleInGroup('Quads', 'HAMSTRINGS')).toBe(false);
  });

  it('breaks focus ties by LOAD_GROUPS order', () => {
    const tie = ex('tie', { impact: [{ muscle: 'Triceps', score: 50 }, { muscle: 'Chest', score: 50 }] });
    // CHEST 50 = TRICEPS 50; CHEST comes first in LOAD_GROUPS
    expect(projectedFocus([tie])).toBe('CHEST');
  });

  it('computes push:pull as legacy (P17 hand-check 3:1 → imbalanced)', () => {
    // push: flat, incline, ohp (press) = 3; pull: pulldown (pull) = 1 → 3/1 = 3 > 2
    expect(pushPullRatio([FLAT, INCLINE, OHP, PULLDOWN])).toEqual({ push: 3, pull: 1, ratio: 3, imbalanced: true });
    // 1 push / 1 pull = 1 → balanced
    expect(pushPullRatio([FLAT, PULLDOWN])).toMatchObject({ push: 1, pull: 1, imbalanced: false });
    expect(pushPullRatio([FLAT]).ratio).toBe(1); // pull 0 → ratio = push = 1
    // "Squat Row" counts once as push (squat) and once as pull (row): 1/1 = 1
    expect(pushPullRatio([{ pattern: 'Squat Row' }])).toEqual({ push: 1, pull: 1, ratio: 1, imbalanced: false });
  });
});
