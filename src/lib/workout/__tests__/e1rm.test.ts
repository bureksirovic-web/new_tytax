import { describe, it, expect } from 'vitest';
import { brzycki, volumeLoad, getWarmupSets } from '../e1rm';

describe('brzycki', () => {
  it('returns weight for 1 rep (1RM = weight)', () => {
    expect(brzycki(100, 1)).toBe(100);
  });
  it('gives higher e1RM for more reps at same weight', () => {
    expect(brzycki(80, 10)).toBeGreaterThan(brzycki(80, 5));
  });
  it('handles 5RM correctly (~88% of e1RM)', () => {
    const e1rm = brzycki(88, 5);
    expect(e1rm).toBeCloseTo(99, 0);
  });
  it('caps at 36 reps', () => {
    expect(brzycki(50, 36)).toBe(brzycki(50, 40));
  });
});

describe('volumeLoad', () => {
  it('returns 0 for empty sets', () => {
    expect(volumeLoad([])).toBe(0);
  });
  it('sums weight * reps correctly', () => {
    expect(volumeLoad([{weight:100,reps:5},{weight:80,reps:10}])).toBe(1300);
  });
});

describe('getWarmupSets', () => {
  it('returns 4 warmup sets', () => {
    expect(getWarmupSets(100)).toHaveLength(4);
  });
  it('first set is ~40% of working weight', () => {
    const sets = getWarmupSets(100);
    expect(sets[0].weight).toBeCloseTo(40, -1);
  });
  it('rounds weights to nearest 2.5', () => {
    const sets = getWarmupSets(100);
    sets.forEach(s => {
      expect(s.weight % 2.5).toBe(0);
    });
  });
});
