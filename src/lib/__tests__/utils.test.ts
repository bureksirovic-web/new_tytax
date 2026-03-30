import { describe, it, expect } from 'vitest';
import {
  slugify,
  formatDuration,
  formatWeight,
  getWeekKey,
  isoDate,
  escapeCSV
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
