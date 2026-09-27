import { describe, expect, it } from 'vitest';
import { restDayLocked } from '../youth';

// Local-time dates so the "same calendar day" check is deterministic.
const now = new Date(2026, 8, 27, 18, 0, 0);
const youth = { birthYear: 2015 }; // 2026 - 2015 = 11 -> youth
const adult = { birthYear: 1985 };

describe('restDayLocked (youth rest days are completed, never rushed)', () => {
  it('locks a youth rest day when the program advanced earlier today', () => {
    expect(restDayLocked(youth, { updatedAt: new Date(2026, 8, 27, 7, 30).toISOString() }, now)).toBe(true);
  });
  it('unlocks it once the last advance was on an earlier day', () => {
    expect(restDayLocked(youth, { updatedAt: new Date(2026, 8, 26, 23, 59).toISOString() }, now)).toBe(false);
  });
  it('never locks an adult or a profile without a birth year', () => {
    const today = { updatedAt: new Date(2026, 8, 27, 7, 30).toISOString() };
    expect(restDayLocked(adult, today, now)).toBe(false);
    expect(restDayLocked({}, today, now)).toBe(false);
  });
  it('does not lock on a missing or unparseable timestamp', () => {
    expect(restDayLocked(youth, null, now)).toBe(false);
    expect(restDayLocked(youth, { updatedAt: 'not-a-date' }, now)).toBe(false);
  });
});
