import { describe, it, expect } from 'vitest';
import { brzycki, volumeLoad, getWarmupSets } from '../e1rm';
import { e1rm } from '@/lib/training';

describe('brzycki (delegates to training.e1rm)', () => {
  it('returns weight for 1 rep (1RM = weight)', () => {
    expect(brzycki(100, 1)).toBe(100);
  });
  it('gives higher e1RM for more reps at same weight', () => {
    expect(brzycki(80, 10)).toBeGreaterThan(brzycki(80, 5));
  });
  it('handles 5RM correctly', () => {
    // 88 * 36 / (37 - 5) = 3168 / 32 = 99
    expect(brzycki(88, 5)).toBe(99);
  });
  it('switches to Epley from 37 reps, same as the engine', () => {
    // Epley: 50 * (1 + 40/30) = 50 * 70/30 = 116.666…
    expect(brzycki(50, 40)).toBeCloseTo(116.667, 3);
    expect(brzycki(50, 40)).toBe(e1rm(50, 40));
  });
});

describe('volumeLoad', () => {
  it('returns 0 for empty sets', () => {
    expect(volumeLoad([])).toBe(0);
  });
  it('sums weight * reps correctly', () => {
    // 100*5 + 80*10 = 500 + 800 = 1300
    expect(volumeLoad([{weight:100,reps:5},{weight:80,reps:10}])).toBe(1300);
  });
});

describe('getWarmupSets', () => {
  it('standard ladder by default: 50%×10, 75%×5', () => {
    const sets = getWarmupSets(100);
    // 100 * 0.5 = 50; 100 * 0.75 = 75 (both already multiples of 2.5)
    expect(sets.map((s) => [s.percent, s.weight, s.reps])).toEqual([
      [50, 50, 10],
      [75, 75, 5],
    ]);
  });
  it('heavy ladder returns 4 warm-up sets', () => {
    // 50%, 75%, 85%, 95% of 100 → 50, 75, 85, 95
    expect(getWarmupSets(100, 'kg', 'heavy').map((s) => s.weight)).toEqual([50, 75, 85, 95]);
  });
  it('rounds weights to the nearest 2.5 and labels with the unit', () => {
    const sets = getWarmupSets(93, 'lb');
    // 93 * 0.5 = 46.5 → 47.5; 93 * 0.75 = 69.75 → 70
    expect(sets.map((s) => s.weight)).toEqual([47.5, 70]);
    sets.forEach((s) => expect(s.weight % 2.5).toBe(0));
    expect(sets[0].label).toBe('50% × 10 lb');
  });
});
