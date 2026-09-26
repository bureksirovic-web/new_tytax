import { describe, expect, it } from 'vitest';
import { coerceCalendarDay, coerceTimestamp } from '../coerce';

const FB = '2000-01-01T00:00:00.000Z';

describe('coerceTimestamp', () => {
  it("turns a v2 isoDate() day into midnight UTC of that day", () => {
    expect(coerceTimestamp('2026-01-01', FB)).toBe('2026-01-01T00:00:00.000Z');
    expect(coerceTimestamp(' 2026-03-09 ', FB)).toBe('2026-03-09T00:00:00.000Z');
  });

  it('keeps a canonical ISO datetime byte-for-byte and normalises other ISO shapes to UTC ms', () => {
    expect(coerceTimestamp('2026-03-01T08:00:00.000Z', FB)).toBe('2026-03-01T08:00:00.000Z');
    expect(coerceTimestamp('2026-03-01T08:00Z', FB)).toBe('2026-03-01T08:00:00.000Z');
    expect(coerceTimestamp('2026-03-01T10:00:00+02:00', FB)).toBe('2026-03-01T08:00:00.000Z');
  });

  it('falls back for non-strings, junk, non-ISO dates and overflowed days', () => {
    for (const bad of [undefined, null, 17, '', 't', 'March 1 2026', '2026-13-01', '2026-02-30', '2026-02-30T00:00:00.000Z']) {
      expect(coerceTimestamp(bad, FB)).toBe(FB);
    }
  });
});

describe('coerceCalendarDay', () => {
  it("keeps a day, cuts a datetime to its day, and drops what is not a real day", () => {
    expect(coerceCalendarDay('2026-03-01')).toBe('2026-03-01');
    expect(coerceCalendarDay('2026-03-01T23:30:00.000Z')).toBe('2026-03-01');
    expect(coerceCalendarDay('2026-02-30')).toBeUndefined();
    expect(coerceCalendarDay('soon')).toBeUndefined();
    expect(coerceCalendarDay(20260301)).toBeUndefined();
  });
});
