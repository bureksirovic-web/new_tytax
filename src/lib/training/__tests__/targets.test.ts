import { describe, expect, it } from 'vitest';
import { parseTarget } from '../targets';

describe('parseTarget', () => {
  it('plain rep ranges and single values', () => {
    expect(parseTarget('8-12')).toEqual({ min: 8, max: 12, unit: 'reps', perSide: false });
    expect(parseTarget('10')).toEqual({ min: 10, max: 10, unit: 'reps', perSide: false });
  });

  it('per-side reps, with and without a range', () => {
    expect(parseTarget('8/side')).toEqual({ min: 8, max: 8, unit: 'reps', perSide: true });
    expect(parseTarget('10-15/leg')).toEqual({ min: 10, max: 15, unit: 'reps', perSide: true });
  });

  it('hold durations, with and without a range or side', () => {
    expect(parseTarget('10-30s')).toEqual({ min: 10, max: 30, unit: 's', perSide: false });
    expect(parseTarget('30s/side')).toEqual({ min: 30, max: 30, unit: 's', perSide: true });
  });

  it('null for anything else', () => {
    expect(parseTarget('')).toBeNull();
    expect(parseTarget('amrap')).toBeNull();
    expect(parseTarget('12-8')).toBeNull(); // max < min
    expect(parseTarget('8/arm')).toBeNull();
  });
  it('tolerates spaces around the separators', () => {
    expect(parseTarget('  10 - 15 s / side  ')).toEqual({ min: 10, max: 15, unit: 's', perSide: true });
    expect(parseTarget('8 / leg')).toEqual({ min: 8, max: 8, unit: 'reps', perSide: true });
    expect(parseTarget(' 12 ')).toEqual({ min: 12, max: 12, unit: 'reps', perSide: false });
  });
});
