import { describe, it, expect } from 'vitest';
import type { Exercise } from '@/contracts/domain';
import type { ExerciseLookup } from '@/contracts/training';
import { computeVolumeParity, getParityLabel, patternOf } from '../volume-parity';
import { daysBefore, makeLog, type FixtureExercise } from './fixtures';

const NOW = new Date(2026, 8, 20, 12, 0, 0);
const TODAY = daysBefore(NOW, 0);

const PATTERNS: Record<string, string> = {
  'ex-push': 'Horizontal Push',
  'ex-pull': 'Horizontal Pull',
  'ex-squat': 'Squat',
  'ex-hinge': 'Hinge',
  'ex-carry': 'Carry',
  'ex-core': 'Core',
};

const lookup: ExerciseLookup = (id) =>
  PATTERNS[id] ? ({ id, pattern: PATTERNS[id] } as Pick<Exercise, 'id' | 'pattern'> as Exercise) : undefined;

function parity(exercises: FixtureExercise[], date = TODAY, extra = {}) {
  return computeVolumeParity([makeLog(date, exercises, extra)], 30, { now: NOW, lookup });
}

const tenByHundred = [{ kg: 100, reps: 10 }];

describe('computeVolumeParity', () => {
  it('returns balanced score for equal push/pull/hinge/quad volume', () => {
    const results = parity(['ex-push', 'ex-pull', 'ex-squat', 'ex-hinge'].map((id) => ({ id, sets: tenByHundred })));
    const by = Object.fromEntries(results.map((r) => [r.pattern, r]));
    // each pattern: 100×10 = 1000 of 4000 → 25 %; target 20 → delta +5 → balanced (|5| ≤ 5)
    for (const p of ['push', 'pull', 'quad', 'hinge']) {
      expect(by[p].volume).toBe(1000);
      expect(by[p].percentage).toBe(25);
      expect(by[p].status).toBe('balanced');
    }
  });

  it('returns unbalanced score when one pattern dominates', () => {
    const push = parity([{ id: 'ex-push', sets: tenByHundred }, { id: 'ex-push', sets: tenByHundred }]).find((r) => r.pattern === 'push');
    // push = 100 % of volume; target 20 → delta +80 → overtrained
    expect(push?.delta).toBe(80);
    expect(push?.status).toBe('overtrained');
  });

  it('counts only done working sets, recent live logs; unknown ids are other', () => {
    const exercises: FixtureExercise[] = [
      { id: 'ex-push', sets: [{ kg: 100, reps: 10 }, { kg: 50, reps: 10, type: 'warmup' }, { kg: 100, reps: 10, done: false }] },
      { id: 'mystery', sets: [{ kg: 100, reps: 10 }] },
    ];
    const results = parity(exercises);
    // push 1000, other 1000 (warm-up and undone excluded) → 50 % each
    expect(results.find((r) => r.pattern === 'push')?.volume).toBe(1000);
    expect(results.find((r) => r.pattern === 'other')?.percentage).toBe(50);
    // 31 days ago is outside the 30-day window → all zero
    expect(parity(exercises, daysBefore(NOW, 31)).every((r) => r.volume === 0)).toBe(true);
    // soft-deleted → all zero
    expect(parity(exercises, TODAY, { deletedAt: 'x' }).every((r) => r.volume === 0)).toBe(true);
  });

  it('returns results for all 7 movement patterns', () => {
    const patterns = parity([{ id: 'ex-push', sets: [{ kg: 50, reps: 5 }] }]).map((r) => r.pattern);
    expect([...patterns].sort()).toEqual(['carry', 'core', 'hinge', 'other', 'pull', 'push', 'quad']);
  });

  it('handles empty logs', () => {
    const results = computeVolumeParity([], 30, { now: NOW, lookup });
    expect(results).toHaveLength(7);
    results.forEach((r) => {
      expect(r.volume).toBe(0);
      expect(r.percentage).toBe(0);
      // 0 − target
      expect(r.delta).toBe(-r.targetPercentage);
    });
  });

  it('maps catalog patterns to movement patterns', () => {
    expect(patternOf('ex-carry', lookup)).toBe('carry');
    expect(patternOf('ex-core', lookup)).toBe('core');
    expect(patternOf('nope', lookup)).toBe('other');
  });
});

describe('getParityLabel', () => {
  it('returns balanced for delta within +/-5', () => {
    for (const d of [0, 5, -5, 3, -3]) expect(getParityLabel(d)).toBe('balanced');
  });

  it('returns overtrained for delta > 5', () => {
    for (const d of [6, 20, 50]) expect(getParityLabel(d)).toBe('overtrained');
  });

  it('returns undertrained for delta < -5', () => {
    for (const d of [-6, -20, -50]) expect(getParityLabel(d)).toBe('undertrained');
  });
});
