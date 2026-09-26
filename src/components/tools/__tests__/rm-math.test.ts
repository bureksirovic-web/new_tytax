import { describe, it, expect } from 'vitest';
import {
  brzycki,
  estimate1RM,
  percentTable,
  repMaxTable,
  repMaxWeight,
  roundTo,
} from '../rm-math';

describe('brzycki', () => {
  it('REQUIRED: 100 x 5 -> ~112.51, displayed 112.5', () => {
    // 100 / (1.0278 - 0.0278*5) = 100 / (1.0278 - 0.139) = 100 / 0.8888 = 112.5112...
    expect(brzycki(100, 5)).toBeCloseTo(112.5112, 3);
    // 112.5112 / 0.5 = 225.02 -> round 225 -> 112.5
    expect(estimate1RM(100, 5)).toBe(112.5);
  });

  it('1 rep returns the weight itself', () => {
    expect(brzycki(100, 1)).toBe(100);
    expect(estimate1RM(137.5, 1)).toBe(137.5);
  });

  it('100 x 10 -> 133.37, displayed 133.5', () => {
    // 100 / (1.0278 - 0.278) = 100 / 0.7498 = 133.3689; /0.5 = 266.74 -> 267 -> 133.5
    expect(brzycki(100, 10)).toBeCloseTo(133.3689, 3);
    expect(estimate1RM(100, 10)).toBe(133.5);
  });

  it('80 x 8 -> 99.33, displayed 99.5', () => {
    // 80 / (1.0278 - 0.2224) = 80 / 0.8054 = 99.329; /0.5 = 198.66 -> 199 -> 99.5
    expect(brzycki(80, 8)).toBeCloseTo(99.329, 2);
    expect(estimate1RM(80, 8)).toBe(99.5);
  });

  it('102.5 x 3 -> 108.53, displayed 108.5', () => {
    // 102.5 / (1.0278 - 0.0834) = 102.5 / 0.9444 = 108.534; /0.5 = 217.07 -> 217 -> 108.5
    expect(estimate1RM(102.5, 3)).toBe(108.5);
  });

  it('10 reps is the last Brzycki rep count', () => {
    // 100 / (1.0278 - 0.278) = 100 / 0.7498 = 133.3689
    expect(brzycki(100, 10)).toBeCloseTo(133.3689, 3);
  });

  it('11+ reps use Epley', () => {
    // 100 * (1 + 11/30) = 136.667 | 100 * (1 + 20/30) = 166.667 | 100 * (1 + 36/30) = 220
    expect(brzycki(100, 11)).toBeCloseTo(136.667, 2);
    expect(brzycki(100, 20)).toBeCloseTo(166.667, 2);
    expect(brzycki(100, 36)).toBeCloseTo(220, 6);
    // 60 * (1 + 40/30) = 60 * 2.3333 = 140
    expect(brzycki(60, 40)).toBeCloseTo(140, 6);
  });

  it('no jump at 36 -> 37 reps (old Brzycki gave 3703.7 then 223.3)', () => {
    // 36: 100 * 2.2 = 220 -> 220 | 37: 100 * 2.2333 = 223.33 -> /0.5 = 446.67 -> 447 -> 223.5
    expect(estimate1RM(100, 36)).toBe(220);
    expect(estimate1RM(100, 37)).toBe(223.5);
  });

  it('estimate rises with reps from 1 to 60', () => {
    for (let r = 2; r <= 60; r++) expect(brzycki(100, r)).toBeGreaterThan(brzycki(100, r - 1));
  });

  it('fractional reps are floored (5.9 counts as 5)', () => {
    expect(brzycki(100, 5.9)).toBe(brzycki(100, 5));
  });

  it.each([
    [0, 5],
    [-100, 5],
    [100, 0],
    [100, -3],
    [100, 0.5],
    [Number.NaN, 5],
    [100, Number.NaN],
    [Number.POSITIVE_INFINITY, 5],
  ])('invalid weight=%s reps=%s -> 0', (w, r) => {
    expect(brzycki(w, r)).toBe(0);
    expect(estimate1RM(w, r)).toBe(0);
  });
});

describe('roundTo', () => {
  it('removes float noise', () => {
    expect(roundTo(107.50000000000001, 2.5)).toBe(107.5);
    expect(roundTo(0.1 + 0.2, 0.5)).toBe(0.5); // 0.3/0.5 = 0.6 -> 1 -> 0.5
  });
  it('rounds half up in step units', () => {
    expect(roundTo(101.25, 2.5)).toBe(102.5); // 40.5 -> 41 -> 102.5
    expect(roundTo(112.25, 0.5)).toBe(112.5); // 224.5 -> 225 -> 112.5
  });
});

describe('percentTable', () => {
  it('100 kg 1RM -> 100..50 exactly', () => {
    const rows = percentTable(100);
    expect(rows.map((r) => r.percent)).toEqual([100, 95, 90, 85, 80, 75, 70, 65, 60, 55, 50]);
    expect(rows.map((r) => r.kg)).toEqual([100, 95, 90, 85, 80, 75, 70, 65, 60, 55, 50]);
  });

  it('112.5 kg 1RM rounds each row to 2.5', () => {
    // 95%: 106.875/2.5=42.75->43->107.5 | 90%: 101.25/2.5=40.5->41->102.5
    // 85%: 95.625/2.5=38.25->38->95     | 80%: 90
    // 75%: 84.375/2.5=33.75->34->85     | 70%: 78.75/2.5=31.5->32->80
    // 65%: 73.125/2.5=29.25->29->72.5   | 60%: 67.5
    // 55%: 61.875/2.5=24.75->25->62.5   | 50%: 56.25/2.5=22.5->23->57.5
    expect(percentTable(112.5).map((r) => r.kg)).toEqual([
      112.5, 107.5, 102.5, 95, 90, 85, 80, 72.5, 67.5, 62.5, 57.5,
    ]);
  });

  it.each([0, -10, Number.NaN])('invalid 1RM %s -> []', (x) => {
    expect(percentTable(x)).toEqual([]);
  });
});

describe('repMaxTable (inverse of brzycki())', () => {
  it('100 kg 1RM -> 1..12 rep maxes rounded to 2.5', () => {
    // w = 100 * (1.0278 - 0.0278 r), then /2.5, round, *2.5:
    // r1 100 | r2 97.22->38.89->39->97.5 | r3 94.44->37.78->38->95 | r4 91.66->36.66->37->92.5
    // r5 88.88->35.55->36->90 | r6 86.10->34.44->34->85 | r7 83.32->33.33->33->82.5
    // r8 80.54->32.22->32->80 | r9 77.76->31.10->31->77.5 | r10 74.98->29.99->30->75
    // r11+ inverse Epley w = 100 / (1 + r/30):
    // r11 73.17->29.27->29->72.5 | r12 71.43->28.57->29->72.5
    const rows = repMaxTable(100);
    expect(rows.map((r) => r.reps)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(rows.map((r) => r.kg)).toEqual([100, 97.5, 95, 92.5, 90, 85, 82.5, 80, 77.5, 75, 72.5, 72.5]);
  });

  it('is monotonically non-increasing', () => {
    const kg = repMaxTable(143).map((r) => r.kg);
    for (let i = 1; i < kg.length; i++) expect(kg[i]).toBeLessThanOrEqual(kg[i - 1]);
  });

  it('round-trips with brzycki', () => {
    expect(repMaxWeight(brzycki(100, 5), 5)).toBeCloseTo(100, 9);
    expect(repMaxWeight(brzycki(72.5, 11), 11)).toBeCloseTo(72.5, 9);
  });

  it('repMaxWeight edge cases', () => {
    expect(repMaxWeight(100, 1)).toBe(100);
    expect(repMaxWeight(0, 5)).toBe(0);
    expect(repMaxWeight(100, 0)).toBe(0);
    expect(repMaxWeight(100, Number.NaN)).toBe(0);
  });

  it.each([0, -1, Number.NaN])('invalid 1RM %s -> []', (x) => {
    expect(repMaxTable(x)).toEqual([]);
  });
});
