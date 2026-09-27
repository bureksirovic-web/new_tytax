import { describe, expect, it } from 'vitest';
import { normalizeDate, parseLegacyBackup, parseNumeric } from '..';
import { safeIso } from '../coerce';
import { MAX_DURATION_SECONDS } from '../normalize-log';

const HUGE = '9'.repeat(400);
const EPOCH_ID = 1735732800000; // 2025-01-01T12:00:00Z

const log = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: 1, date: '2025-01-01', session: 'A', exercises: [], ...over,
});

const firstUser = (input: unknown) => {
  const user = parseLegacyBackup(input).users[0];
  if (!user) throw new Error('expected one user');
  return user;
};

describe('numeric overflow', () => {
  it('parseNumeric rejects digit strings that overflow to Infinity', () => {
    expect(parseNumeric(HUGE)).toBe('invalid');
    expect(parseNumeric(`-${HUGE}`)).toBe('invalid');
    expect(parseNumeric('1e5')).toBe('invalid');
    expect(parseNumeric('82,5')).toBe(82.5);
  });

  it('a set with an overflowing kg is skipped with INVALID_SET', () => {
    const { warnings, users } = parseLegacyBackup({
      logs: [log({ exercises: [{ name: 'X', sets: [{ kg: HUGE, reps: 5, done: true }] }] })],
    });
    expect(users[0]?.logs[0]?.exercises[0]?.sets).toEqual([]);
    expect(warnings.some((w) => w.code === 'INVALID_SET')).toBe(true);
  });

  it('an overflowing rir is dropped with INVALID_VALUE and the set is kept', () => {
    const { warnings, users } = parseLegacyBackup({
      logs: [log({ exercises: [{ name: 'X', sets: [{ kg: 60, reps: 5, rir: HUGE, done: true }] }] })],
    });
    const set = users[0]?.logs[0]?.exercises[0]?.sets[0];
    expect(set).toEqual({ kg: 60, reps: 5, done: true, type: 'working' });
    expect(warnings.some((w) => w.code === 'INVALID_VALUE' && w.path.endsWith('.rir'))).toBe(true);
  });

  it('an overflowing bodyweight entry is not imported', () => {
    const user = firstUser({ tytax_bodyweight_log: [{ date: '2025-01-01', value: HUGE }] });
    expect(user.bodyweight).toEqual([]);
  });
});

describe('huge duration does not crash the import', () => {
  it.each([1e20, HUGE])('duration %s is dropped with a warning; finishedAt kept', (duration) => {
    const { warnings, users } = parseLegacyBackup({ logs: [log({ id: EPOCH_ID, duration })] });
    const l = users[0]?.logs[0];
    expect(l?.durationSeconds).toBe(0);
    expect(l?.startedAt).toBeUndefined();
    expect(l?.finishedAt).toBe('2025-01-01T12:00:00.000Z');
    expect(warnings.some((w) => w.code === 'INVALID_VALUE' && w.path.endsWith('.duration'))).toBe(true);
  });

  it('a duration of exactly 24 h is kept', () => {
    const l = firstUser({ logs: [log({ id: EPOCH_ID, duration: MAX_DURATION_SECONDS })] }).logs[0];
    expect(l?.durationSeconds).toBe(MAX_DURATION_SECONDS);
    expect(l?.startedAt).toBe('2024-12-31T12:00:00.000Z');
  });

  it('safeIso returns undefined for values a Date cannot hold', () => {
    expect(safeIso(Number.NaN)).toBeUndefined();
    expect(safeIso(Number.POSITIVE_INFINITY)).toBeUndefined();
    expect(safeIso(8.64e15 + 1)).toBeUndefined();
    expect(safeIso(0)).toBe('1970-01-01T00:00:00.000Z');
  });
});

describe('duplicate id suffixing', () => {
  it('keeps sourceIds unique when a real id equals a generated suffix', () => {
    const ids = firstUser({ logs: [log({ id: '5' }), log({ id: '5' }), log({ id: '5#2' })] }).logs.map((l) => l.sourceId);
    expect(ids).toEqual(['5', '5#2', '5#2#2']);
  });

  it('skips a suffix already taken by an earlier real id', () => {
    const ids = firstUser({ logs: [log({ id: '5' }), log({ id: '5#2' }), log({ id: '5' })] }).logs.map((l) => l.sourceId);
    expect(ids).toEqual(['5', '5#2', '5#3']);
  });
});

describe('strict datetime parsing', () => {
  it.each(['2025-02-30T10:00:00Z', '2025-04-31T00:00:00Z', '2025-01-01T24:00:00Z', '2025-01-01T10:60Z', '2025-01-01Tjunk'])(
    'rejects %s',
    (s) => expect(normalizeDate(s)).toBeNull(),
  );

  it('rejects an impossible day in plain form too', () => {
    expect(normalizeDate('2025-02-30')).toBeNull();
  });

  it('accepts a real UTC datetime and date matches the iso day', () => {
    expect(normalizeDate('2025-02-28T10:00:00.5Z')).toEqual({ date: '2025-02-28', iso: '2025-02-28T10:00:00.500Z' });
  });

  it('reads an offset-less datetime as UTC', () => {
    expect(normalizeDate('2025-01-05T23:30:00')).toEqual({ date: '2025-01-05', iso: '2025-01-05T23:30:00.000Z' });
    expect(normalizeDate('2025-01-05T23:30')).toEqual({ date: '2025-01-05', iso: '2025-01-05T23:30:00.000Z' });
  });

  it('gives the same startedAt under different host time zones', () => {
    const input = { logs: [log({ date: '2025-01-05T23:30:00' })] };
    const saved = process.env.TZ;
    try {
      const results = ['UTC', 'Asia/Tokyo', 'America/New_York'].map((tz) => {
        process.env.TZ = tz;
        return firstUser(input).logs[0]?.startedAt;
      });
      expect(results).toEqual(Array(3).fill('2025-01-05T23:30:00.000Z'));
    } finally {
      if (saved === undefined) delete process.env.TZ;
      else process.env.TZ = saved;
    }
  });
});
