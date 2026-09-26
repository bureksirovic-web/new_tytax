import { describe, expect, it } from 'vitest';
import { stationKey } from '../labels';

describe('stationKey', () => {
  it('labels every catalog station id, including the app-level FRAME and FREE_WEIGHT', () => {
    expect(stationKey('SMITH')).toBe('prog_station_smith');
    expect(stationKey('back-upper')).toBe('prog_station_back_upper');
    expect(stationKey('FRAME')).toBe('station_FRAME');
    expect(stationKey('FREE_WEIGHT')).toBe('station_FREE_WEIGHT');
    expect(stationKey('unknown')).toBeUndefined();
  });
});
