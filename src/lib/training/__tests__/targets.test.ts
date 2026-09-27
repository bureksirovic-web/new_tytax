import { describe, expect, it } from 'vitest';
import { parseTarget } from '../targets';

describe('parseTarget', () => {
  it('a range', () => {
    expect(parseTarget('8-12')).toEqual({ min: 8, max: 12, unit: 'reps', perSide: false });
  });

  it('a single number', () => {
    expect(parseTarget('10')).toEqual({ min: 10, max: 10, unit: 'reps', perSide: false });
  });

  it('a single number per side', () => {
    expect(parseTarget('8/side')).toEqual({ min: 8, max: 8, unit: 'reps', perSide: true });
  });

  it('a range per leg', () => {
    expect(parseTarget('10-15/leg')).toEqual({ min: 10, max: 15, unit: 'reps', perSide: true });
  });

  it('a time range', () => {
    expect(parseTarget('10-30s')).toEqual({ min: 10, max: 30, unit: 's', perSide: false });
  });

  it('a single time value per side', () => {
    expect(parseTarget('30s/side')).toEqual({ min: 30, max: 30, unit: 's', perSide: true });
  });

  it('tolerates surrounding and internal whitespace', () => {
    expect(parseTarget('  10 - 15 s / side  ')).toEqual({ min: 10, max: 15, unit: 's', perSide: true });
  });

  it('throws on an unparseable string', () => {
    expect(() => parseTarget('lots')).toThrow();
    expect(() => parseTarget('')).toThrow();
  });
});
