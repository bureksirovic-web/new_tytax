import { describe, it, expect } from 'vitest';
import { exerciseStationKey, stationKey } from '../station-key';

// Carried over from the deleted order-by-station.test.ts 'stationRank' case: the
// same spellings, asserted on the key the inventory match compares.
describe('stationKey', () => {
  it('normalises case, hyphens, spaces and the display-name aliases', () => {
    expect(stationKey('smith')).toBe('SMITH');
    expect(stationKey('Smith Machine')).toBe('SMITH');
    expect(stationKey('back-upper')).toBe('BACK_UPPER');
    expect(stationKey('Back Lower Pulley')).toBe('BACK_LOWER');
    expect(stationKey('LEG_EXTENSION')).toBe('LEG_EXTENSION');
    expect(stationKey('leg curl')).toBe('LEG_CURL');
    expect(stationKey('frame')).toBe('FRAME');
    expect(stationKey('free weight')).toBe('FREE_WEIGHT');
    expect(stationKey('Free Weights')).toBe('FREE_WEIGHT');
    expect(stationKey('tytax')).toBe('TYTAX');
    expect(stationKey(undefined)).toBeUndefined();
    expect(stationKey(null)).toBeUndefined();
    expect(stationKey('')).toBeUndefined();
    expect(stationKey(' - ')).toBeUndefined();
  });

  it('prefers stationId over the display station', () => {
    expect(exerciseStationKey({ stationId: 'BACK_UPPER', station: 'Smith Machine' })).toBe('BACK_UPPER');
    expect(exerciseStationKey({ station: 'Back Upper Pulley' })).toBe('BACK_UPPER');
    expect(exerciseStationKey({ stationId: '', station: '' })).toBeUndefined();
    expect(exerciseStationKey(undefined)).toBeUndefined();
  });
});
