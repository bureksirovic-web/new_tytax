import { describe, expect, it } from 'vitest';
import { kgToUnits, LB_PER_KG, parseNonNegative, unitsToKg } from '../units';

describe('kgToUnits', () => {
  it('keeps kg and rounds to one decimal', () => {
    // 80.04 kg → 80.0 at one decimal
    expect(kgToUnits(80.04, 'kg')).toBe(80);
  });

  it('converts kg to lb and rounds to one decimal', () => {
    // 100 × 2.20462 = 220.462 → 220.5
    expect(kgToUnits(100, 'lb')).toBe(220.5);
  });
});

describe('unitsToKg', () => {
  it('is the identity for kg', () => {
    // kg input is stored as-is
    expect(unitsToKg(72.5, 'kg')).toBe(72.5);
  });

  it('converts lb to kg without rounding', () => {
    // 220.462 / 2.20462 = 100
    expect(unitsToKg(220.462, 'lb')).toBeCloseTo(100, 9);
    // 1 lb = 1 / 2.20462 kg
    expect(unitsToKg(1, 'lb')).toBeCloseTo(1 / LB_PER_KG, 12);
  });
});

describe('parseNonNegative', () => {
  it('reads plain and comma decimals', () => {
    // "80" → 80
    expect(parseNonNegative('80')).toBe(80);
    // "80,5" uses a decimal comma → 80.5
    expect(parseNonNegative(' 80,5 ')).toBe(80.5);
  });

  it('returns null for empty input and undefined for anything invalid', () => {
    expect(parseNonNegative('   ')).toBeNull();
    expect(parseNonNegative('-3')).toBeUndefined();
    expect(parseNonNegative('abc')).toBeUndefined();
    expect(parseNonNegative('1e3')).toBeUndefined();
    expect(parseNonNegative('1.')).toBeUndefined();
  });
});
