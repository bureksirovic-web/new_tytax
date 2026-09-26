import { describe, it, expect } from 'vitest';
import {
  slugify,
  formatDuration,
  formatWeight,
  getWeekKey,
  isoDate,
  escapeCSV,
  kgToDisplay,
  displayToKg,
  localDay,
  parseLocalDay,
  LB_PER_KG,
} from '../utils';

describe('slugify', () => {
  it('converts strings to slug format', () => {
    expect(slugify('Hello World')).toBe('hello-world');
  });

  it('removes special characters', () => {
    expect(slugify('Hello!@# World$%^')).toBe('hello-world');
  });

  it('handles multiple spaces', () => {
    expect(slugify('Hello   World')).toBe('hello-world');
  });

  it('handles mixed case and trailing/leading spaces', () => {
    expect(slugify('  HeLlO WoRlD  ')).toBe('hello-world');
  });
});

describe('formatDuration', () => {
  it('formats hours and minutes correctly', () => {
    // 3661 seconds = 1 hour, 1 minute, 1 second
    // but the function returns `1h 1m`
    expect(formatDuration(3661)).toBe('1h 1m');
  });

  it('formats minutes and seconds correctly', () => {
    // 61 seconds = 1 minute, 1 second
    expect(formatDuration(61)).toBe('1m 1s');
  });

  it('formats seconds correctly', () => {
    expect(formatDuration(45)).toBe('45s');
  });
});

describe('formatWeight', () => {
  it('formats metric correctly', () => {
    expect(formatWeight(100)).toBe('100 kg');
    expect(formatWeight(100, 'metric')).toBe('100 kg');
  });

  it('formats imperial correctly and rounds to nearest 0.25', () => {
    // 100 kg = 220.462 lbs -> 220.5 lbs
    expect(formatWeight(100, 'imperial')).toBe('220.5 lb');
  });
});

describe('getWeekKey', () => {
  it('returns ISO week string', () => {
    const key = getWeekKey(new Date('2024-01-15T00:00:00Z'));
    expect(key).toMatch(/^\d{4}-W\d{2}$/);
    expect(key).toBe('2024-W03');
  });
});

describe('isoDate', () => {
  it('returns YYYY-MM-DD format', () => {
    const date = new Date('2024-01-15T12:00:00Z');
    expect(isoDate(date)).toBe('2024-01-15');
  });
});

describe('escapeCSV', () => {
  it('escapes strings with commas', () => {
    expect(escapeCSV('hello,world')).toBe('"hello,world"');
  });

  it('escapes strings with quotes', () => {
    expect(escapeCSV('say "hi"')).toBe('"say ""hi"""');
  });

  it('escapes strings with newlines', () => {
    expect(escapeCSV('hello\nworld')).toBe('"hello\nworld"');
  });

  it('does not escape simple strings', () => {
    expect(escapeCSV('helloworld')).toBe('helloworld');
  });
});

describe('kgToDisplay / displayToKg', () => {
  it('kg passes through unchanged', () => {
    expect(kgToDisplay(62.5, 'kg')).toBe(62.5);
    expect(displayToKg(62.5, 'kg')).toBe(62.5);
  });

  it('lb = kg × 2.20462, display rounded to 0.1', () => {
    // 100 × 2.20462 = 220.462 → 220.5
    expect(kgToDisplay(100, 'lb')).toBe(220.5);
    // 20 × 2.20462 = 44.0924 → 44.1
    expect(kgToDisplay(20, 'lb')).toBe(44.1);
    // 0 × 2.20462 = 0
    expect(kgToDisplay(0, 'lb')).toBe(0);
  });

  it('lb input converts back to kg without rounding', () => {
    // 220.462 / 2.20462 = 100
    expect(displayToKg(220.462, 'lb')).toBeCloseTo(100, 10);
    // 45 / 2.20462 = 20.4117…
    expect(displayToKg(45, 'lb')).toBeCloseTo(20.4117, 4);
    expect(LB_PER_KG).toBe(2.20462);
  });

  it('round-trips an entered lb value through kg storage', () => {
    // 225 lb → 102.058… kg → 225.0 lb
    expect(kgToDisplay(displayToKg(225, 'lb'), 'lb')).toBe(225);
  });
});

describe('localDay / parseLocalDay', () => {
  it('localDay is the local calendar day', () => {
    // local 2024-03-05 23:30 stays on the 5th whatever the UTC offset
    expect(localDay(new Date(2024, 2, 5, 23, 30))).toBe('2024-03-05');
  });

  it('parseLocalDay gives local midnight and round-trips with localDay', () => {
    const d = parseLocalDay('2024-03-05');
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([2024, 2, 5, 0]);
    expect(localDay(d)).toBe('2024-03-05');
    expect(Number.isNaN(parseLocalDay('05.03.2024').getTime())).toBe(true);
  });
});
