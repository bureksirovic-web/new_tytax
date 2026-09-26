import { describe, expect, it } from 'vitest';
import { daysBetweenLocal, parseLocalDate, rotationIndexForDate, todayLocal } from '../calendar';

describe('calendar rotation (G4-16)', () => {
  it('counts local days and wraps the calendar formula (spec hand-checks)', () => {
    expect(daysBetweenLocal('2026-09-20', '2026-09-26')).toBe(6); // 26 − 20
    // start 20th, today 26th, 7 sessions → 6 % 7 = 6 → the 7th (Rest)
    expect(rotationIndexForDate('2026-09-20', '2026-09-26', 7)).toBe(6);
    // start in the future: diff −2 → ((−2 % 7) + 7) % 7 = 5 → Lower C
    expect(rotationIndexForDate('2026-09-28', '2026-09-26', 7)).toBe(5);
    // 9 days on a 4-session rotation: 9 % 4 = 1
    expect(rotationIndexForDate('2026-09-17', '2026-09-26', 4)).toBe(1);
    // same day → 0
    expect(rotationIndexForDate('2026-09-26', '2026-09-26', 3)).toBe(0);
  });

  it('is DST-safe across both CET changes', () => {
    // 25 Oct 2026 (25 h day): 24th → 26th is still 2 days
    expect(daysBetweenLocal('2026-10-24', '2026-10-26')).toBe(2);
    // 29 Mar 2026 (23 h day): 28th → 30th is still 2 days
    expect(daysBetweenLocal('2026-03-28', '2026-03-30')).toBe(2);
    // 2026-03-01 → 2026-11-01 spans both changes: Mar 31 + Apr 30 + May 31 + Jun 30 + Jul 31 + Aug 31 + Sep 30 + Oct 31 = 245
    expect(daysBetweenLocal('2026-03-01', '2026-11-01')).toBe(245);
    // 245 % 7 = 0 (245 = 35 × 7)
    expect(rotationIndexForDate('2026-03-01', '2026-11-01', 7)).toBe(0);
  });

  it('rejects bad input', () => {
    expect(rotationIndexForDate('bad', '2026-09-26', 7)).toBeNull();
    expect(rotationIndexForDate('2026-09-20', '2026-09-26', 0)).toBeNull();
    expect(rotationIndexForDate('2026-09-20', '2026-09-26', 2.5)).toBeNull();
    expect(parseLocalDate('2026-02-30')).toBeNull(); // February has 28 days in 2026
    expect(parseLocalDate('2026-9-26')).toBeNull();
    expect(daysBetweenLocal('2026-09-26', 'x')).toBeNull();
  });

  it('parses to local midnight and formats today as the local day', () => {
    const d = parseLocalDate('2026-09-26');
    expect([d?.getFullYear(), d?.getMonth(), d?.getDate(), d?.getHours()]).toEqual([2026, 8, 26, 0]); // month is 0-based: September = 8
    expect(todayLocal(new Date(2026, 0, 5, 0, 30))).toBe('2026-01-05');
    expect(todayLocal(new Date(2026, 11, 31, 23, 59))).toBe('2026-12-31');
  });
});
