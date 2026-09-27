import { describe, expect, it } from 'vitest';
import {
  addSeconds,
  isDone,
  parseRestTimerState,
  progress,
  remaining,
  start,
  stop,
} from '@/components/workout/runtime/rest-timer';

const T0 = 1_700_000_000_000;

describe('rest-timer model', () => {
  it('start anchors endsAt to now + duration', () => {
    expect(start(T0, 90)).toEqual({ endsAt: T0 + 90_000, totalS: 90 });
  });

  it('start treats invalid durations as zero', () => {
    expect(start(T0, -5)).toEqual({ endsAt: T0, totalS: 0 });
    expect(start(T0, Number.NaN)).toEqual({ endsAt: T0, totalS: 0 });
    expect(start(T0, Infinity)).toEqual({ endsAt: T0, totalS: 0 });
  });

  it('remaining rounds up and never goes negative', () => {
    const s = start(T0, 90);
    expect(remaining(s, T0)).toBe(90);
    expect(remaining(s, T0 + 1)).toBe(90);
    expect(remaining(s, T0 + 999)).toBe(90);
    expect(remaining(s, T0 + 1000)).toBe(89);
    expect(remaining(s, T0 + 89_001)).toBe(1);
    expect(remaining(s, T0 + 90_000)).toBe(0);
    expect(remaining(s, T0 + 500_000)).toBe(0);
  });

  it('remaining is correct after a long background gap (wall clock based)', () => {
    const s = start(T0, 120);
    expect(remaining(s, T0 + 61_500)).toBe(59);
  });

  it('isDone flips exactly at endsAt', () => {
    const s = start(T0, 10);
    expect(isDone(s, T0 + 9_999)).toBe(false);
    expect(isDone(s, T0 + 10_000)).toBe(true);
  });

  it('progress is clamped 0..1', () => {
    const s = start(T0, 100);
    expect(progress(s, T0 - 5_000)).toBe(0);
    expect(progress(s, T0)).toBe(0);
    expect(progress(s, T0 + 25_000)).toBeCloseTo(0.25);
    expect(progress(s, T0 + 100_000)).toBe(1);
    expect(progress(s, T0 + 999_000)).toBe(1);
  });

  it('progress of a zero-length timer is 1', () => {
    expect(progress(start(T0, 0), T0)).toBe(1);
  });

  it('addSeconds extends endsAt and totalS so progress stays <= 1', () => {
    const s = start(T0, 90);
    const at = T0 + 80_000;
    const extended = addSeconds(s, 30, at);
    expect(extended).toEqual({ endsAt: T0 + 120_000, totalS: 120 });
    expect(remaining(extended, at)).toBe(40);
    expect(progress(extended, at)).toBeCloseTo(80 / 120);
    expect(progress(extended, T0 + 200_000)).toBe(1);
  });

  it('addSeconds without now always extends', () => {
    const s = start(T0, 10);
    expect(addSeconds(s, 30)).toEqual({ endsAt: T0 + 40_000, totalS: 40 });
  });

  it('addSeconds on a finished timer restarts from now', () => {
    const s = start(T0, 10);
    const later = T0 + 60_000;
    expect(addSeconds(s, 30, later)).toEqual({ endsAt: later + 30_000, totalS: 30 });
  });

  it('addSeconds ignores invalid amounts', () => {
    const s = start(T0, 10);
    expect(addSeconds(s, Number.NaN, T0)).toEqual(s);
    expect(addSeconds(s, -30, T0)).toEqual(s);
  });

  it('addSeconds with nothing to add never restarts a finished timer', () => {
    const s = start(T0, 10);
    const later = T0 + 60_000;
    expect(addSeconds(s, 0, later)).toBe(s);
    expect(addSeconds(s, -30, later)).toBe(s);
    expect(addSeconds(s, Number.NaN, later)).toBe(s);
  });

  it('stop returns null', () => {
    expect(stop()).toBeNull();
  });

  it('state round-trips through JSON', () => {
    const s = addSeconds(start(T0, 90), 30, T0);
    const parsed = parseRestTimerState(JSON.parse(JSON.stringify(s)));
    expect(parsed).toEqual(s);
    expect(remaining(parsed!, T0)).toBe(120);
  });

  it('parseRestTimerState rejects malformed values', () => {
    expect(parseRestTimerState(null)).toBeNull();
    expect(parseRestTimerState('x')).toBeNull();
    expect(parseRestTimerState({ endsAt: 'a', totalS: 1 })).toBeNull();
    expect(parseRestTimerState({ endsAt: 1, totalS: -1 })).toBeNull();
    expect(parseRestTimerState({ endsAt: 1, totalS: Number.NaN })).toBeNull();
    expect(parseRestTimerState({ endsAt: 1 })).toBeNull();
    expect(parseRestTimerState({ endsAt: 5, totalS: 3, extra: 1 })).toEqual({
      endsAt: 5,
      totalS: 3,
    });
  });
});
