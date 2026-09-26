import { describe, it, expect } from 'vitest';
import { calcPlates, parseWeightInput, DEFAULT_PLATES_KG, MAX_TARGET_KG } from '../plate-math';

describe('calcPlates: required and standard cases (20 kg bar, TYTAX plates)', () => {
  it('100 kg -> [25, 15] per side', () => {
    // (100 - 20) / 2 = 40 per side; greedy: 25 (15 left), 20 > 15 skip, 15 (0 left).
    const r = calcPlates({ targetKg: 100 });
    expect(r.perSide).toEqual([25, 15]);
    expect(r.loadedKg).toBe(100);
    expect(r.remainderKg).toBe(0);
    expect(r.achievable).toBe(true);
  });

  it('bar weight exactly -> no plates, achievable', () => {
    // (20 - 20) / 2 = 0 per side.
    const r = calcPlates({ targetKg: 20 });
    expect(r.perSide).toEqual([]);
    expect(r.loadedKg).toBe(20);
    expect(r.achievable).toBe(true);
  });

  it('60 kg -> [20]', () => {
    // (60 - 20) / 2 = 20 -> one 20.
    expect(calcPlates({ targetKg: 60 }).perSide).toEqual([20]);
  });

  it('142.5 kg uses the 1.25 plate without float drift', () => {
    // (142.5 - 20) / 2 = 61.25; 25+25 = 50 (11.25 left); 10 (1.25 left); 1.25 (0).
    const r = calcPlates({ targetKg: 142.5 });
    expect(r.perSide).toEqual([25, 25, 10, 1.25]);
    expect(r.loadedKg).toBe(142.5);
    expect(r.remainderKg).toBe(0);
    expect(r.achievable).toBe(true);
  });

  it('22.5 kg -> [1.25]', () => {
    // (22.5 - 20) / 2 = 1.25.
    expect(calcPlates({ targetKg: 22.5 }).perSide).toEqual([1.25]);
  });

  it('102.5 kg -> [25, 15, 1.25]', () => {
    // (102.5 - 20) / 2 = 41.25 = 25 + 15 + 1.25.
    expect(calcPlates({ targetKg: 102.5 }).perSide).toEqual([25, 15, 1.25]);
  });

  it('300 kg -> five 25s and a 15', () => {
    // (300 - 20) / 2 = 140 = 5 * 25 (125) + 15.
    expect(calcPlates({ targetKg: 300 }).perSide).toEqual([25, 25, 25, 25, 25, 15]);
  });

  it('three 1.25 plates sum exactly (1.25 * 3 = 3.75 per side)', () => {
    // 20 + 2 * 3.75 = 27.5; only 1.25 plates offered.
    const r = calcPlates({ targetKg: 27.5, plates: [1.25] });
    expect(r.perSide).toEqual([1.25, 1.25, 1.25]);
    expect(r.loadedKg).toBe(27.5);
    expect(r.achievable).toBe(true);
  });
});

describe('calcPlates: non-multiples report nearest lower + remainder', () => {
  it('101 kg -> loads 100, 1 kg remainder', () => {
    // (101 - 20) / 2 = 40.5; 25 + 15 = 40, 0.5 left < 1.25. Loaded 20 + 80 = 100.
    const r = calcPlates({ targetKg: 101 });
    expect(r.perSide).toEqual([25, 15]);
    expect(r.loadedKg).toBe(100);
    expect(r.remainderKg).toBe(1);
    expect(r.achievable).toBe(false);
  });

  it('21 kg -> bar only, 1 kg remainder', () => {
    // (21 - 20) / 2 = 0.5 < 1.25 -> no plate.
    const r = calcPlates({ targetKg: 21 });
    expect(r.perSide).toEqual([]);
    expect(r.loadedKg).toBe(20);
    expect(r.remainderKg).toBe(1);
    expect(r.achievable).toBe(false);
  });

  it('odd gram cannot be split between sides', () => {
    // 20.001 kg = 20001 g; (20001 - 20000) / 2 = 0.5 g -> floor 0.
    const r = calcPlates({ targetKg: 20.001 });
    expect(r.loadedKg).toBe(20);
    expect(r.remainderKg).toBe(0.001);
    expect(r.achievable).toBe(false);
  });

  it('small custom plates leave a sub-plate remainder', () => {
    // plates [0.5, 0.25]; (20.75 - 20) / 2 = 0.375; 0.25 (0.125 left). Loaded 20.5, rem 0.25.
    const r = calcPlates({ targetKg: 20.75, plates: [0.5, 0.25] });
    expect(r.perSide).toEqual([0.25]);
    expect(r.loadedKg).toBe(20.5);
    expect(r.remainderKg).toBe(0.25);
  });
});

describe('calcPlates: below bar and invalid input', () => {
  it('target below bar -> bar only, negative remainder', () => {
    // 10 - 20 = -10.
    const r = calcPlates({ targetKg: 10 });
    expect(r.perSide).toEqual([]);
    expect(r.loadedKg).toBe(20);
    expect(r.remainderKg).toBe(-10);
    expect(r.achievable).toBe(false);
  });

  it.each([0, -5, Number.NaN, Number.POSITIVE_INFINITY])('target %s -> empty result', (targetKg) => {
    expect(calcPlates({ targetKg })).toEqual({
      perSide: [],
      loadedKg: 0,
      remainderKg: 0,
      achievable: false,
    });
  });

  it.each([-1, Number.NaN])('bar %s -> empty result', (barKg) => {
    const r = calcPlates({ targetKg: 100, barKg });
    expect(r.perSide).toEqual([]);
    expect(r.achievable).toBe(false);
  });
});

describe('calcPlates: custom bar, plate sets and inventory', () => {
  it('15 kg bar, 100 kg -> [25, 15, 2.5]', () => {
    // (100 - 15) / 2 = 42.5 = 25 + 15 + 2.5.
    const r = calcPlates({ targetKg: 100, barKg: 15 });
    expect(r.perSide).toEqual([25, 15, 2.5]);
    expect(r.loadedKg).toBe(100);
  });

  it('0 kg bar (e.g. lever with no base) -> 50 kg is one 25 per side', () => {
    expect(calcPlates({ targetKg: 50, barKg: 0 }).perSide).toEqual([25]);
  });

  it('custom plate set [20, 10, 5]', () => {
    // (100 - 20) / 2 = 40 = 20 + 20.
    expect(calcPlates({ targetKg: 100, plates: [20, 10, 5] }).perSide).toEqual([20, 20]);
  });

  it('unsorted and duplicate plate sizes are normalised', () => {
    // same as default 100 kg case: 40 = 25 + 15.
    expect(calcPlates({ targetKg: 100, plates: [5, 15, 25, 25, 0, -2] }).perSide).toEqual([25, 15]);
  });

  it('pairsAvailable = 0 for 25 forces 20s', () => {
    // 40 per side, no 25 -> 20 + 20.
    expect(calcPlates({ targetKg: 100, pairsAvailable: { 25: 0 } }).perSide).toEqual([20, 20]);
  });

  it('limited pairs cascade to smaller plates', () => {
    // (140 - 20) / 2 = 60; 25 x1 (35 left); 20,15 none; 10 x1 (25 left); 5 unlimited x5.
    const r = calcPlates({ targetKg: 140, pairsAvailable: { 25: 1, 20: 0, 15: 0, 10: 1 } });
    expect(r.perSide).toEqual([25, 10, 5, 5, 5, 5, 5]);
    expect(r.loadedKg).toBe(140);
  });

  it('inventory exhausted -> nearest lower + remainder', () => {
    // plates [25] with 1 pair: 40 per side -> 25 (15 left). Loaded 20 + 50 = 70, rem 30.
    const r = calcPlates({ targetKg: 100, plates: [25], pairsAvailable: { 25: 1 } });
    expect(r.perSide).toEqual([25]);
    expect(r.loadedKg).toBe(70);
    expect(r.remainderKg).toBe(30);
    expect(r.achievable).toBe(false);
  });

  it('limited plate list: exact 20 + 20 beats greedy 25 (found 70 before)', () => {
    // 40 per side from {25, 20}: 25 leaves 15 (no fit); 20 + 20 = 40 exact.
    const r = calcPlates({ targetKg: 100, plates: [25, 20] });
    expect(r.perSide).toEqual([20, 20]);
    expect(r.loadedKg).toBe(100);
    expect(r.achievable).toBe(true);
  });

  it('limited pairs: exact 20 + 20 beats greedy 25 (found 70 before)', () => {
    const r = calcPlates({
      targetKg: 100,
      pairsAvailable: { 15: 0, 10: 0, 5: 0, 2.5: 0, 1.25: 0 },
    });
    expect(r.perSide).toEqual([20, 20]);
    expect(r.remainderKg).toBe(0);
    expect(r.achievable).toBe(true);
  });

  it('no exact combination -> largest lower load', () => {
    // 47.5 per side from {25, 20}: sums 0,20,25,40,45 -> 45 = 25 + 20; loaded 20 + 90 = 110, rem 5.
    const r = calcPlates({ targetKg: 115, plates: [25, 20] });
    expect(r.perSide).toEqual([25, 20]);
    expect(r.loadedKg).toBe(110);
    expect(r.remainderKg).toBe(5);
  });

  it(`targets above MAX_TARGET_KG (${MAX_TARGET_KG}) are invalid, never a crash`, () => {
    for (const targetKg of [1000.5, 1e9, 1e11, parseWeightInput('99999999999')]) {
      expect(calcPlates({ targetKg })).toEqual({ perSide: [], loadedKg: 0, remainderKg: 0, achievable: false });
    }
  });

  it('MAX_TARGET_KG itself is solved quickly', () => {
    // (1000 - 20) / 2 = 490 per side = 19 x 25 (475) + 15.
    const start = Date.now();
    const r = calcPlates({ targetKg: MAX_TARGET_KG });
    expect(r.perSide).toEqual([...Array<number>(19).fill(25), 15]);
    expect(r.achievable).toBe(true);
    expect(Date.now() - start).toBeLessThan(500);
  });

  it('default plate set matches legacy TYTAX list', () => {
    expect(DEFAULT_PLATES_KG).toEqual([25, 20, 15, 10, 5, 2.5, 1.25]);
  });
});

describe('parseWeightInput', () => {
  it.each([
    ['100', 100],
    ['102,5', 102.5],
    ['102.5', 102.5],
    [' 60 ', 60],
    ['0', 0],
  ])('%s -> %s', (raw, expected) => {
    expect(parseWeightInput(raw)).toBe(expected);
  });

  it.each(['', 'abc', '1e3', '1.2.3', '10kg'])('%s -> NaN', (raw) => {
    expect(parseWeightInput(raw)).toBeNaN();
  });
});
