import { describe, expect, it } from 'vitest';
import { e1rm, training } from '../index';

describe('e1rm', () => {
  it('Brzycki up to 36 reps', () => {
    // Brzycki: 100*36/(37-5) = 3600/32 = 112.5
    expect(e1rm(100, 5)).toBe(112.5);
    // Brzycki: 100*36/(37-10) = 3600/27 = 133.333…
    expect(e1rm(100, 10)).toBeCloseTo(133.3333, 4);
    // Brzycki: 88*36/(37-5) = 3168/32 = 99
    expect(e1rm(88, 5)).toBe(99);
    // Brzycki at the last valid rep count: 10*36/(37-36) = 360
    expect(e1rm(10, 36)).toBe(360);
  });

  it('Epley from 37 reps', () => {
    // Epley: 30*(1+37/30) = 30 + 37 = 67
    expect(e1rm(30, 37)).toBe(67);
    // Epley: 60*(1+40/30) = 60 + 80 = 140
    expect(e1rm(60, 40)).toBe(140);
  });

  it('1 rep is the weight itself', () => {
    // 1 rep → kg
    expect(e1rm(140, 1)).toBe(140);
  });

  it('zero or negative inputs give 0', () => {
    expect(e1rm(0, 5)).toBe(0);
    expect(e1rm(100, 0)).toBe(0);
    expect(e1rm(-20, 5)).toBe(0);
    expect(e1rm(100, -3)).toBe(0);
    expect(e1rm(Number.NaN, 5)).toBe(0);
  });

  it('is exposed on the training object', () => {
    expect(training.e1rm).toBe(e1rm);
  });
});
