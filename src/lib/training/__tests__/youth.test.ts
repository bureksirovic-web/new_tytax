import { describe, expect, it } from 'vitest';
import { ageFromBirthYear, isYouth, YOUTH_MAX_INCREMENT_KG, youthPrefillOptions } from '../youth';

const NOW = new Date('2026-09-27T12:00:00.000Z');

describe('ageFromBirthYear', () => {
  it('whole calendar years between birthYear and now', () => {
    expect(ageFromBirthYear(2015, NOW)).toBe(11);
    expect(ageFromBirthYear(1990, NOW)).toBe(36);
  });
});

describe('isYouth', () => {
  it('true under 16', () => {
    expect(isYouth({ birthYear: 2015 }, NOW)).toBe(true); // 11
  });

  it('false at or above 16', () => {
    expect(isYouth({ birthYear: 2010 }, NOW)).toBe(false); // 16
    expect(isYouth({ birthYear: 1990 }, NOW)).toBe(false);
  });

  it('false with no birthYear (opt-in data, never assumed) or no profile', () => {
    expect(isYouth({ birthYear: undefined }, NOW)).toBe(false);
    expect(isYouth(undefined, NOW)).toBe(false);
  });
});

describe('youthPrefillOptions', () => {
  it('caps the automatic increase at 1.25 kg', () => {
    expect(youthPrefillOptions()).toEqual({ maxIncrementKg: YOUTH_MAX_INCREMENT_KG });
    expect(YOUTH_MAX_INCREMENT_KG).toBe(1.25);
  });
});
