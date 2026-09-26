import { describe, it, expect } from 'vitest';
import type { SetEntry } from '@/contracts/domain';
import { DEFAULT_PROFILE_SETTINGS } from '@/contracts/domain';
import {
  FALLBACK_REST_S,
  beatsGhostReps,
  buildWarmups,
  canCompleteSet,
  canToggleDone,
  formatNumber,
  hasWarmups,
  heaviestWorkingKg,
  nextSetId,
  restAlerts,
  restSecondsFor,
  setE1rmKg,
  setHasData,
  setNumbers,
} from '../set-rules';

function set(partial: Partial<SetEntry> = {}): SetEntry {
  return { id: partial.id ?? 's', type: 'working', kg: 0, reps: 0, done: false, ...partial };
}

describe('set completion rules', () => {
  it('needs reps and kg, except bodyweight which allows 0 kg', () => {
    expect(canCompleteSet(set({ kg: 80, reps: 5 }), 'tytax')).toBe(true);
    expect(canCompleteSet(set({ kg: 0, reps: 5 }), 'tytax')).toBe(false);
    expect(canCompleteSet(set({ kg: 80, reps: 0 }), 'tytax')).toBe(false);
    expect(canCompleteSet(set({ kg: 0, reps: 12 }), 'bodyweight')).toBe(true);
    expect(canCompleteSet(set({ kg: 0, reps: 12 }), 'kettlebell')).toBe(false);
  });

  it('always allows undoing a done set', () => {
    expect(canToggleDone(set({ done: true }), 'tytax')).toBe(true);
    expect(canToggleDone(set(), 'tytax')).toBe(false);
  });

  it('beats the ghost only with strictly more reps', () => {
    expect(beatsGhostReps(set({ reps: 9, ghostReps: 8 }))).toBe(true);
    expect(beatsGhostReps(set({ reps: 8, ghostReps: 8 }))).toBe(false);
    expect(beatsGhostReps(set({ reps: 9 }))).toBe(false);
  });

  it('knows when a set holds user data', () => {
    expect(setHasData(set())).toBe(false);
    expect(setHasData(set({ ghostKg: 80, ghostReps: 8 }))).toBe(false);
    expect(setHasData(set({ kg: 1 }))).toBe(true);
    expect(setHasData(set({ rir: 0 }))).toBe(true);
    expect(setHasData(set({ done: true }))).toBe(true);
  });
});

describe('e1RM', () => {
  it('uses training.e1rm and ignores warm-ups', () => {
    // Brzycki: 100 × 36 / (37 − 5) = 3600 / 32 = 112.5
    expect(setE1rmKg(set({ kg: 100, reps: 5 }))).toBeCloseTo(112.5, 6);
    // Epley from 37 reps: 50 × (1 + 40/30) = 50 × 2.3333 = 116.67
    expect(setE1rmKg(set({ kg: 50, reps: 40 }))).toBeCloseTo(116.667, 2);
    expect(setE1rmKg(set({ type: 'warmup', kg: 100, reps: 5 }))).toBe(0);
    expect(setE1rmKg(set({ kg: 100, reps: 0 }))).toBe(0);
  });

  it('formats to at most one decimal', () => {
    expect(formatNumber(112.5)).toBe('112.5');
    expect(formatNumber(116.6667)).toBe('116.7');
    expect(formatNumber(100)).toBe('100');
  });
});

describe('rest length', () => {
  it('prefers the exercise, then the profile, then 90 s', () => {
    expect(restSecondsFor({ restSeconds: 120 }, { restSeconds: 60 })).toBe(120);
    expect(restSecondsFor({}, { restSeconds: 60 })).toBe(60);
    expect(restSecondsFor({}, {})).toBe(FALLBACK_REST_S);
    expect(restSecondsFor({ restSeconds: 0 }, undefined)).toBe(90);
  });
});

describe('warm-ups', () => {
  const ids = () => {
    let n = 0;
    return () => `w${++n}`;
  };

  it('uses the heaviest working weight, typed or ghost', () => {
    const sets = [set({ type: 'warmup', kg: 200 }), set({ kg: 80 }), set({ kg: 0, ghostKg: 90 })];
    expect(heaviestWorkingKg(sets)).toBe(90);
    expect(heaviestWorkingKg([set({ type: 'warmup', kg: 50 })])).toBe(0);
    expect(hasWarmups(sets)).toBe(true);
    expect(hasWarmups(sets.slice(1))).toBe(false);
  });

  it('builds the standard ladder (50% × 10, 75% × 5)', () => {
    const w = buildWarmups(100, DEFAULT_PROFILE_SETTINGS);
    // 100 × 0.5 = 50, 100 × 0.75 = 75 (already on the 2.5 kg grid)
    expect(w.map((s) => [s.type, s.kg, s.reps, s.done])).toEqual([
      ['warmup', 50, 10, false],
      ['warmup', 75, 5, false],
    ]);
  });

  it("falls back to one 50% set for strategy 'none'", () => {
    const w = buildWarmups(85, { warmupStrategy: 'none', barWeightKg: 20 }, ids());
    // 85 × 0.5 = 42.5 → on the 2.5 grid
    expect(w).toEqual([{ id: 'w1', type: 'warmup', kg: 42.5, reps: 10, done: false }]);
  });

  it('falls back when the strategy yields nothing (weight at the bar) and skips 0 kg', () => {
    const w = buildWarmups(20, { warmupStrategy: 'standard', barWeightKg: 20 }, ids());
    // generateWarmups: working ≤ bar → []; fallback 20 × 0.5 = 10
    expect(w).toEqual([{ id: 'w1', type: 'warmup', kg: 10, reps: 10, done: false }]);
    expect(buildWarmups(0, DEFAULT_PROFILE_SETTINGS)).toEqual([]);
  });
});

describe('ordering helpers', () => {
  it('finds the next set and numbers warm-ups separately', () => {
    const sets = [set({ id: 'a', type: 'warmup' }), set({ id: 'b', type: 'warmup' }), set({ id: 'c' }), set({ id: 'd', type: 'drop' })];
    expect(nextSetId(sets, 'b')).toBe('c');
    expect(nextSetId(sets, 'd')).toBeUndefined();
    expect(nextSetId(sets, 'zz')).toBeUndefined();
    expect(setNumbers(sets)).toEqual([1, 2, 1, 2]);
  });

  it('shares one alert instance', () => {
    expect(restAlerts()).toBe(restAlerts());
    expect(typeof restAlerts().unlock).toBe('function');
  });
});
