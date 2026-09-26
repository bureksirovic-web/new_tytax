import { describe, expect, it } from 'vitest';
import { generateWarmups, training, WARMUP_LADDERS } from '../index';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function shape(workingKg: number, strategy: Parameters<typeof generateWarmups>[1], opts?: Parameters<typeof generateWarmups>[2]) {
  return generateWarmups(workingKg, strategy, opts).map((s) => [s.kg, s.reps]);
}

describe('generateWarmups (ladders ported from the original app)', () => {
  it('standard: 50%×10, 75%×5', () => {
    // 100*0.5 = 50; 100*0.75 = 75
    expect(shape(100, 'standard')).toEqual([
      [50, 10],
      [75, 5],
    ]);
  });

  it('heavy: 50%×10, 75%×5, 85%×3, 95%×1', () => {
    // 100 × 0.5/0.75/0.85/0.95 = 50/75/85/95
    expect(shape(100, 'heavy')).toEqual([
      [50, 10],
      [75, 5],
      [85, 3],
      [95, 1],
    ]);
  });

  it('pyramid: 40%×12, 60%×8, 80%×4', () => {
    // 100 × 0.4/0.6/0.8 = 40/60/80
    expect(shape(100, 'pyramid')).toEqual([
      [40, 12],
      [60, 8],
      [80, 4],
    ]);
  });

  it('rounds to the nearest 2.5 kg by default', () => {
    // 93*0.5 = 46.5 → 46.5/2.5 = 18.6 → 19 × 2.5 = 47.5
    // 93*0.75 = 69.75 → 27.9 → 28 × 2.5 = 70
    expect(shape(93, 'standard')).toEqual([
      [47.5, 10],
      [70, 5],
    ]);
  });

  it('honours a custom rounding increment and bar weight', () => {
    // heavy 102.5, round 1.25: 51.25 → 41×1.25 = 51.25; 76.875 → 61.5 → 62×1.25 = 77.5;
    // 87.125 → 69.7 → 70×1.25 = 87.5; 97.375 → 77.9 → 78×1.25 = 97.5
    expect(shape(102.5, 'heavy', { roundToKg: 1.25 }).map(([kg]) => kg)).toEqual([51.25, 77.5, 87.5, 97.5]);
    // bar 15, round 5: 60*0.5 = 30 → 6×5 = 30; 60*0.75 = 45 → 9×5 = 45
    expect(shape(60, 'standard', { barKg: 15, roundToKg: 5 })).toEqual([
      [30, 10],
      [45, 5],
    ]);
  });

  it('never goes below the bar', () => {
    // 30*0.5 = 15 → max(20, 15) = 20; 30*0.75 = 22.5 → 22.5
    expect(shape(30, 'standard')).toEqual([
      [20, 10],
      [22.5, 5],
    ]);
  });

  it('drops a step equal to the previous one or reaching the working weight', () => {
    // standard 25: 12.5 → bar 20; 18.75 → 7.5 → 8×2.5 = 20 → same as previous → dropped
    expect(shape(25, 'standard')).toEqual([[20, 10]]);
    // heavy 22.5: 11.25 → 12.5 → bar 20; 16.875 → 17.5 → 20 dup; 19.125 → 20 dup;
    // 21.375 → 8.55 → 9×2.5 = 22.5 ≥ 22.5 working → dropped
    expect(shape(22.5, 'heavy')).toEqual([[20, 10]]);
  });

  it('returns [] at or below the bar and for strategy none', () => {
    expect(generateWarmups(20, 'standard')).toEqual([]);
    expect(generateWarmups(15, 'heavy')).toEqual([]);
    expect(generateWarmups(0, 'pyramid')).toEqual([]);
    expect(generateWarmups(100, 'none')).toEqual([]);
    // bar 30: working 30 is not above the bar
    expect(generateWarmups(30, 'standard', { barKg: 30 })).toEqual([]);
  });

  it('produces undone warm-up sets with unique uuid ids', () => {
    const sets = training.generateWarmups(100, 'heavy');
    // heavy ladder has 4 steps, none dropped at 100 kg
    expect(sets).toHaveLength(WARMUP_LADDERS.heavy.length);
    expect(sets.every((s) => s.type === 'warmup' && s.done === false)).toBe(true);
    expect(sets.every((s) => UUID.test(s.id))).toBe(true);
    expect(new Set(sets.map((s) => s.id)).size).toBe(4);
  });
});
