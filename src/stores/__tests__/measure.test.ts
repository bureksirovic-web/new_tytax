import { describe, it, expect } from 'vitest';
import type { Exercise } from '@/contracts/domain';
import tytax from '@/data/tytax/exercises.json';
import { BODYWEIGHT_EXERCISES } from '@/data/bodyweight/exercises';
import { KB_EXERCISES as KETTLEBELL_EXERCISES } from '@/data/kettlebell/exercises';
import { cleanSeconds, formatDuration, isTimeSet, MAX_SET_SECONDS, measureOf, parseDuration } from '../measure';

describe('measureOf', () => {
  it('uses the catalog tag when present', () => {
    const tagged = (measure: Exercise['measure'], defaultReps: string): Partial<Exercise> => ({ measure, defaultReps });
    expect(measureOf(tagged('time', '8-12'))).toBe('time');
    expect(measureOf(tagged('reps', '30-60s'))).toBe('reps');
  });

  // Supersedes the local `defaultReps` heuristic fallback (removed once G1 tagged the
  // catalog): untagged means 'reps', and the catalog invariant below proves every
  // time-target exercise carries the tag, so no exercise lost its time measure.
  it('is reps for an untagged exercise, whatever its defaultReps', () => {
    expect(measureOf({})).toBe('reps');
    const untagged: Partial<Exercise> = { defaultReps: '30-60s' };
    expect(measureOf(untagged)).toBe('reps');
  });

  it('catalog: every time-target exercise is tagged time, and every time tag has a time target', () => {
    const TIME_TARGET = /^\s*\d+(-\d+)?\s*(s|sec|secs|seconds|min)\b/i;
    const all: Exercise[] = [...(tytax as unknown as Exercise[]), ...BODYWEIGHT_EXERCISES, ...KETTLEBELL_EXERCISES];
    const heuristicOnly = all.filter((e) => TIME_TARGET.test(e.defaultReps) && e.measure !== 'time').map((e) => e.id);
    const tagOnly = all.filter((e) => e.measure === 'time' && !TIME_TARGET.test(e.defaultReps)).map((e) => e.id);
    expect(heuristicOnly).toEqual([]);
    expect(tagOnly).toEqual([]);
    // 74 tytax + 12 bodyweight + 6 kettlebell = 92 tagged (G1 notes: "~92").
    expect(all.filter((e) => measureOf(e) === 'time')).toHaveLength(92);
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
