import { describe, it, expect } from 'vitest';
import { cleanSeconds, formatDuration, isTimeSet, MAX_SET_SECONDS, measureOf, parseDuration } from '../measure';

describe('measureOf', () => {
  it('uses the catalog tag when present', () => {
    expect(measureOf({ measure: 'time', defaultReps: '8-12' })).toBe('time');
    expect(measureOf({ measure: 'reps', defaultReps: '30-60s' })).toBe('reps');
  });

  it('falls back to the defaultReps time-target heuristic', () => {
    for (const t of ['30-60s', '2-5 min', '15-30s hold', '20-40s', '45 sec', '60 seconds', ' 10s/side', '1 MIN']) {
      expect(measureOf({ defaultReps: t }), t).toBe('time');
    }
    for (const t of ['8-12', '12-20/side', '8-12 (2s hold)', '8-12 (2s hold)/side', '5x5', '', 'AMRAP', '10 minutes']) {
      expect(measureOf({ defaultReps: t }), t).toBe('reps');
    }
  });

  it('is reps for an unknown exercise', () => {
    expect(measureOf(undefined)).toBe('reps');
  });
});

describe('isTimeSet', () => {
  it('follows an explicit measure, else the durationSeconds field', () => {
    expect(isTimeSet({}, 'time')).toBe(true);
    expect(isTimeSet({ durationSeconds: 30 }, 'reps')).toBe(false);
    expect(isTimeSet({ durationSeconds: 0 })).toBe(true);
    expect(isTimeSet({})).toBe(false);
  });
});

describe('durations', () => {
  it('formats m:ss', () => {
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(45)).toBe('0:45');
    expect(formatDuration(125)).toBe('2:05'); // 2*60 + 5
    expect(formatDuration(720)).toBe('12:00');
    expect(formatDuration(59.9)).toBe('0:59');
    expect(formatDuration(-5)).toBe('0:00');
    expect(formatDuration(Number.NaN)).toBe('0:00');
  });

  it('cleans seconds', () => {
    expect(cleanSeconds(undefined)).toBe(0);
    expect(cleanSeconds(Number.POSITIVE_INFINITY)).toBe(0);
    expect(cleanSeconds(-1)).toBe(0);
    expect(cleanSeconds(30.7)).toBe(30);
    // Capped at 24 h = 24 * 3600 = 86400 (G2 rejects more).
    expect(MAX_SET_SECONDS).toBe(86400);
    expect(cleanSeconds(86400)).toBe(86400);
    expect(cleanSeconds(999999)).toBe(86400);
  });

  it('parses seconds and m:ss', () => {
    expect(parseDuration('45')).toBe(45);
    expect(parseDuration('1:30')).toBe(90);
    expect(parseDuration(' 01:05 ')).toBe(65);
    expect(parseDuration('2:5')).toBe(125);
    expect(parseDuration('1:60')).toBeUndefined();
    expect(parseDuration('abc')).toBeUndefined();
    expect(parseDuration('')).toBeUndefined();
    expect(parseDuration('-5')).toBeUndefined();
    // 86400 s = 1440:00 is the limit; one second more is rejected.
    expect(parseDuration('86400')).toBe(86400);
    expect(parseDuration('1440:00')).toBe(86400);
    expect(parseDuration('86401')).toBeUndefined();
    expect(parseDuration('1440:01')).toBeUndefined();
    expect(parseDuration('999999')).toBeUndefined();
  });
});
