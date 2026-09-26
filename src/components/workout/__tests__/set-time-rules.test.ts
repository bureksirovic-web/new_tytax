import { describe, it, expect } from 'vitest';
import { canCompleteTimeSet, canToggleTimeDone, ghostSecondsForSets, ghostSecondsOf, rowMeasure, setSeconds } from '../set-time-rules';
import { holdElapsedSeconds } from '../hold-timer';
import { durationText, parseDurationText } from '../set-time-duration';

describe('rowMeasure', () => {
  it('uses the caller measure when given', () => {
    expect(rowMeasure({ durationSeconds: 30 }, 'reps')).toBe('reps');
    expect(rowMeasure({}, 'time')).toBe('time');
  });
  it('without a measure, a set carrying durationSeconds (even 0) is a time set', () => {
    expect(rowMeasure({ durationSeconds: 0 })).toBe('time');
    expect(rowMeasure({})).toBe('reps');
  });
});

describe('time set done rules', () => {
  it('needs more than 0 whole seconds to complete', () => {
    expect(canCompleteTimeSet({})).toBe(false);
    expect(canCompleteTimeSet({ durationSeconds: 0 })).toBe(false);
    expect(canCompleteTimeSet({ durationSeconds: 0.9 })).toBe(false); // floors to 0
    expect(canCompleteTimeSet({ durationSeconds: -5 })).toBe(false);
    expect(canCompleteTimeSet({ durationSeconds: 1 })).toBe(true);
  });
  it('undo is always allowed', () => {
    expect(canToggleTimeDone({ done: true })).toBe(true);
    expect(canToggleTimeDone({ done: false, durationSeconds: 0 })).toBe(false);
    expect(canToggleTimeDone({ done: false, durationSeconds: 45 })).toBe(true);
  });
  it('setSeconds and ghostSecondsOf clean the value', () => {
    expect(setSeconds({ durationSeconds: 45.7 })).toBe(45);
    expect(setSeconds({})).toBe(0);
    expect(ghostSecondsOf(undefined)).toBeUndefined();
    expect(ghostSecondsOf(0)).toBeUndefined();
    expect(ghostSecondsOf(Number.NaN)).toBeUndefined();
    expect(ghostSecondsOf(60.2)).toBe(60);
  });
});

describe('holdElapsedSeconds', () => {
  it('floors whole seconds between two timestamps', () => {
    // 12 400 ms → 12 s; 999 ms → 0 s; 60 000 ms → 60 s
    expect(holdElapsedSeconds(1_000, 13_400)).toBe(12);
    expect(holdElapsedSeconds(1_000, 1_999)).toBe(0);
    expect(holdElapsedSeconds(0, 60_000)).toBe(60);
  });
  it('reads a clock that went backwards, or NaN, as 0', () => {
    expect(holdElapsedSeconds(5_000, 4_000)).toBe(0);
    expect(holdElapsedSeconds(Number.NaN, 4_000)).toBe(0);
  });
});

describe('duration text', () => {
  it('shows stored seconds as m:ss, empty for none', () => {
    expect(durationText(90)).toBe('1:30');
    expect(durationText(45)).toBe('0:45');
    expect(durationText(0)).toBe('');
    expect(durationText(undefined)).toBe('');
  });
  it('parses seconds or m:ss; empty clears; junk is null', () => {
    expect(parseDurationText('45')).toBe(45);
    expect(parseDurationText('1:30')).toBe(90); // 1×60 + 30
    expect(parseDurationText(' 2:05 ')).toBe(125); // 2×60 + 5
    expect(parseDurationText('')).toBeUndefined();
    expect(parseDurationText('  ')).toBeUndefined();
    expect(parseDurationText('1:')).toBeNull();
    expect(parseDurationText('abc')).toBeNull();
    expect(parseDurationText('1:75')).toBeNull();
  });
});

describe('ghostSecondsForSets', () => {
  it('maps last session by working index and skips warm-ups', () => {
    const sets = [{ type: 'warmup' as const }, { type: 'working' as const }, { type: 'working' as const }, { type: 'working' as const }];
    // Working sets 0,1,2 ← last [30, 0, 45.9]: 30, 0 → none, 45.9 → 45 (whole seconds); warm-up → none.
    expect(ghostSecondsForSets(sets, [30, 0, 45.9])).toEqual([undefined, 30, undefined, 45]);
    // A working position last session did not have → none.
    expect(ghostSecondsForSets([{ type: 'working' }, { type: 'working' }], [20])).toEqual([20, undefined]);
    expect(ghostSecondsForSets([], [20])).toEqual([]);
  });
});
