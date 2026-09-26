import { describe, expect, it } from 'vitest';
import { beatsGhost, e1rmBrzycki, ghostRepsFor, workingIndexOf, type GhostSetLike } from '@/components/workout/runtime/ghost';

const W = (reps: number | null, done = true): GhostSetLike => ({ reps, type: 'working', done });
const U = (reps: number | null): GhostSetLike => ({ reps, type: 'warmup', done: true });

describe('ghostRepsFor', () => {
  it('indexes among working sets only (warm-ups excluded)', () => {
    const prev = [U(10), U(5), W(8), W(7), W(6)];
    expect(ghostRepsFor(prev, 0)).toBe(8);
    expect(ghostRepsFor(prev, 1)).toBe(7);
    expect(ghostRepsFor(prev, 2)).toBe(6);
  });

  it('fixes the legacy misalignment: raw index 0 would be a warm-up', () => {
    const prev = [U(10), W(8)];
    expect(ghostRepsFor(prev, 0)).toBe(8);
  });

  it('handles warm-ups interleaved anywhere', () => {
    expect(ghostRepsFor([W(9), U(3), W(7)], 1)).toBe(7);
  });

  it('returns null past the end, for no history, or bad indexes', () => {
    expect(ghostRepsFor([W(8)], 1)).toBeNull();
    expect(ghostRepsFor([], 0)).toBeNull();
    expect(ghostRepsFor(null, 0)).toBeNull();
    expect(ghostRepsFor(undefined, 0)).toBeNull();
    expect(ghostRepsFor([W(8)], -1)).toBeNull();
    expect(ghostRepsFor([W(8)], 0.5)).toBeNull();
  });

  it('returns null for empty/invalid reps', () => {
    expect(ghostRepsFor([W(null)], 0)).toBeNull();
    expect(ghostRepsFor([W(0)], 0)).toBeNull();
    expect(ghostRepsFor([W(Number.NaN)], 0)).toBeNull();
  });

  it('onlyDone skips sets that were never completed', () => {
    const prev = [W(8, false), W(6, true)];
    expect(ghostRepsFor(prev, 0)).toBe(8);
    expect(ghostRepsFor(prev, 0, { onlyDone: true })).toBe(6);
  });
});

describe('workingIndexOf', () => {
  it('maps a raw set index to its working index', () => {
    const sets = [U(1), U(1), W(1), U(1), W(1)];
    expect(workingIndexOf(sets, 0)).toBeNull();
    expect(workingIndexOf(sets, 2)).toBe(0);
    expect(workingIndexOf(sets, 4)).toBe(1);
    expect(workingIndexOf(sets, 9)).toBeNull();
  });
});

describe('beatsGhost', () => {
  it('is strictly greater', () => {
    expect(beatsGhost(9, 8)).toBe(true);
    expect(beatsGhost(8, 8)).toBe(false);
    expect(beatsGhost(7, 8)).toBe(false);
  });

  it('is false without a ghost or reps', () => {
    expect(beatsGhost(9, null)).toBe(false);
    expect(beatsGhost(null, 8)).toBe(false);
    expect(beatsGhost(undefined, undefined)).toBe(false);
    expect(beatsGhost(0, 0)).toBe(false);
  });
});

describe('e1rmBrzycki', () => {
  it('returns kg for a single', () => {
    expect(e1rmBrzycki(100, 1)).toBe(100);
  });

  it('uses Brzycki up to 10 reps', () => {
    expect(e1rmBrzycki(100, 5)).toBeCloseTo(112.5);
    expect(e1rmBrzycki(100, 10)).toBeCloseTo(133.333, 2);
  });

  it('switches to Epley above 10 reps', () => {
    expect(e1rmBrzycki(100, 11)).toBeCloseTo(100 * (1 + 11 / 30));
    expect(e1rmBrzycki(30, 37)).toBeCloseTo(30 * (1 + 37 / 30));
    expect(e1rmBrzycki(20, 60)).toBeCloseTo(60);
  });

  it('increases with reps and stays realistic (no spike near 36/37)', () => {
    let prev = 0;
    for (let reps = 1; reps <= 60; reps++) {
      const v = e1rmBrzycki(100, reps) as number;
      expect(v).toBeGreaterThan(prev);
      prev = v;
    }
    expect(e1rmBrzycki(100, 36)).toBeLessThan(250);
    expect(e1rmBrzycki(100, 37)).toBeLessThan(250);
  });

  it('returns null on invalid input', () => {
    expect(e1rmBrzycki(null, 5)).toBeNull();
    expect(e1rmBrzycki(100, null)).toBeNull();
    expect(e1rmBrzycki(0, 5)).toBeNull();
    expect(e1rmBrzycki(-5, 5)).toBeNull();
    expect(e1rmBrzycki(100, 0)).toBeNull();
    expect(e1rmBrzycki(100, 0.5)).toBeNull();
    expect(e1rmBrzycki(Number.NaN, 5)).toBeNull();
    expect(e1rmBrzycki(100, Infinity)).toBeNull();
  });
});
