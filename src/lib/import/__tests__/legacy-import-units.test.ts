import { describe, expect, it } from 'vitest';
import { matchKey, normalizeDate, normalizeName, parseLegacyBackup, parseNumeric, utf8ByteLength } from '..';
import { epochMsFromId, parseBoolean } from '../coerce';

const log = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: 1, date: '2025-01-01', session: 'A', exercises: [], ...over,
});
const withSets = (sets: unknown[]): Record<string, unknown> => log({ exercises: [{ name: 'X', sets }] });

describe('coercion helpers', () => {
  it('parseNumeric', () => {
    expect(parseNumeric(5)).toBe(5);
    expect(parseNumeric(' 82,5 ')).toBe(82.5);
    expect(parseNumeric('.5')).toBe(0.5);
    expect(parseNumeric('')).toBe('blank');
    expect(parseNumeric(null)).toBe('blank');
    expect(parseNumeric(undefined)).toBe('blank');
    expect(parseNumeric('12kg')).toBe('invalid');
    expect(parseNumeric(Number.NaN)).toBe('invalid');
    expect(parseNumeric(true)).toBe('invalid');
  });

  it('normalizeDate', () => {
    expect(normalizeDate('2024-02-29')).toEqual({ date: '2024-02-29' });
    expect(normalizeDate('2025-02-29')).toBeNull();
    expect(normalizeDate('2025-01-05T23:30:00+02:00')).toEqual({ date: '2025-01-05', iso: '2025-01-05T21:30:00.000Z' });
    expect(normalizeDate('2025-13-45T99:00')).toBeNull();
    expect(normalizeDate('05.01.2025')).toBeNull();
  });

  it('normalizeName collapses newlines and whitespace like the legacy app', () => {
    expect(normalizeName('  TYTAX T1 |\n\n Smith \t Squat  ')).toBe('TYTAX T1 | Smith Squat');
  });

  it('epochMsFromId and parseBoolean', () => {
    expect(epochMsFromId('1735732800000')).toBe(1735732800000);
    expect(epochMsFromId(42)).toBeUndefined();
    expect(epochMsFromId('abc')).toBeUndefined();
    expect(epochMsFromId(1.5)).toBeUndefined();
    expect(parseBoolean('true')).toBe(true);
    expect(parseBoolean(false)).toBe(false);
    expect(parseBoolean('yes')).toBeUndefined();
  });

  it('utf8ByteLength handles 1-4 byte sequences and lone surrogates', () => {
    expect(utf8ByteLength('aé€😀')).toBe(1 + 2 + 3 + 4);
    expect(utf8ByteLength('\ud800x')).toBe(4);
    expect(utf8ByteLength('\ud800')).toBe(3);
    expect(utf8ByteLength('abcdef', 2)).toBe(3);
  });
});

describe('key matcher', () => {
  it('splits usernames with underscores and spaces by the longest known prefix', () => {
    expect(matchKey('tytax_logs_Ana_B')).toMatchObject({ base: 'tytax_logs', user: 'Ana_B' });
    expect(matchKey('tytax_bodyweight_log_log_Ana')).toMatchObject({ base: 'tytax_bodyweight_log', user: 'log_Ana' });
    expect(matchKey('tytax_bar_weight_Marko Horvat')).toMatchObject({ base: 'tytax_bar_weight', user: 'Marko Horvat' });
    expect(matchKey('tytax_language')?.base).toBe('tytax_language');
    expect(matchKey('tytax_language')?.user).toBeUndefined();
    expect(matchKey('tytax_logsAna')).toBeNull();
    expect(matchKey('tytax_unknown_thing')).toBeNull();
  });
});

describe('set and log normalization edge cases', () => {
  const parseSets = (sets: unknown[]) => {
    const b = parseLegacyBackup({ logs: [withSets(sets)] });
    return { sets: b.users[0]?.logs[0]?.exercises[0]?.sets, warnings: b.warnings };
  };

  it('maps set types and warns on unknown ones', () => {
    const { sets, warnings } = parseSets([
      { kg: 1, reps: 1, done: true, type: 'dropset' },
      { kg: 1, reps: 1, done: true, type: 'Failure' },
      { kg: 1, reps: 1, done: true, type: 'myo' },
    ]);
    expect(sets?.map((s) => s.type)).toEqual(['drop', 'failure', 'working']);
    expect(warnings).toEqual([{ code: 'UNKNOWN_SET_TYPE', path: 'logs[0].exercises[0].sets[2].type', message: 'Unknown set type "myo" treated as working' }]);
  });

  it('skips sets with unreadable or negative kg/reps, drops unreadable rir', () => {
    const { sets, warnings } = parseSets([
      { kg: 'heavy', reps: 5, done: true },
      { kg: -5, reps: 5, done: true },
      { kg: 5, reps: 5, rir: 'x', done: true },
      { kg: 5, reps: 5, rir: -1, done: false },
      'not-a-set',
    ]);
    expect(sets).toEqual([
      { kg: 5, reps: 5, done: true, type: 'working' },
      { kg: 5, reps: 5, done: false, type: 'working' },
    ]);
    expect(warnings.map((w) => w.code)).toEqual(['INVALID_SET', 'INVALID_SET', 'INVALID_VALUE', 'INVALID_VALUE', 'INVALID_SET']);
  });

  it('skips exercises without a usable name and warns on bad numbers', () => {
    const b = parseLegacyBackup({
      logs: [log({ rpe: 'hard', duration: -3, notes: null, exercises: [{ name: ' \n ', sets: [] }, { sets: [] }] })],
    });
    const l = b.users[0]?.logs[0];
    expect(l?.exercises).toEqual([]);
    expect(l?.rpe).toBeUndefined();
    expect(l?.durationSeconds).toBe(0);
    expect(l?.startedAt).toBeUndefined();
    expect(b.warnings.map((w) => w.path)).toEqual(['logs[0].duration', 'logs[0].rpe', 'logs[0].exercises[0].name', 'logs[0].exercises[1].name']);
  });

  it('gives missing and duplicate ids deterministic source ids', () => {
    const b = parseLegacyBackup({ logs: [log({ id: undefined }), log({ id: 7 }), log({ id: '7' }), log({ id: 7 })] });
    expect(b.users[0]?.logs.map((l) => l.sourceId)).toEqual(['legacy:2025-01-01:0', '7', '7#2', '7#3']);
    expect(b.warnings.filter((w) => w.code === 'DUPLICATE_LOG_ID')).toHaveLength(2);
  });
});

describe('dump edge cases', () => {
  it('discovers users missing from the list, ignores unknown and empty-user keys', () => {
    const b = parseLegacyBackup({
      tytax_users_list: '["Ana", 5, " Ana "]',
      tytax_logs_Zed: '[]',
      tytax_logs_Ana: '[]',
      tytax_logs_: '[]',
      tytax_users_list_Ana: '[]',
      tytax_mystery: '1',
      unrelated: 'x',
    });
    expect(b.users.map((u) => u.username)).toEqual(['Ana', 'Zed']);
    expect(b.warnings.map((w) => w.code).sort()).toEqual(['EMPTY_USERNAME', 'INVALID_VALUE', 'UNKNOWN_KEY', 'UNKNOWN_KEY', 'USER_NOT_IN_LIST']);
  });

  it('discovers suffixed users without a list, ignoring un-suffixed leftovers', () => {
    const b = parseLegacyBackup({ tytax_logs_Ana: [log()], tytax_logs: [log()], tytax_bar_weight: 'abc' });
    expect(b.users.map((u) => u.username)).toEqual(['Ana']);
    expect(b.warnings.map((w) => w.code)).toEqual(['LEGACY_LEFTOVER_IGNORED', 'INVALID_VALUE']);
  });

  it('warns on invalid JSON values but tolerates raw strings and JSON-quoted raw strings', () => {
    const b = parseLegacyBackup({
      tytax_logs: '[{broken',
      tytax_warmup_strategy: '"Heavy"',
      tytax_start_date: '"2025-01-0',
      tytax_oled_mode: true,
      tytax_language: 'de',
    });
    const u = b.users[0];
    expect(u?.logs).toEqual([]);
    expect(u?.settings).toEqual({ oledMode: true, warmupStrategy: 'Heavy' });
    expect(b.warnings.map((w) => `${w.code}:${w.path}`)).toEqual([
      'INVALID_JSON_VALUE:tytax_logs',
      'INVALID_VALUE:tytax_language',
      'INVALID_VALUE:tytax_start_date',
    ]);
  });

  it('warns on wrongly typed containers instead of failing', () => {
    const b = parseLegacyBackup({
      tytax_logs: '{"a":1}',
      tytax_training_plan: '[1]',
      tytax_session_order: '"Upper"',
      tytax_bodyweight_log: '{}',
      tytax_custom_protocols: '[{"id":"c","name":"P"}, 3]',
      tytax_pinned_metrics: '{}',
      tytax_warmup_strategy: '',
      tytax_auto_backup: 'true',
    });
    const u = b.users[0];
    expect(u?.settings).toEqual({ autoBackup: true, pinnedMetrics: [] });
    expect(u?.customProtocols).toEqual([]);
    expect(b.warnings).toHaveLength(8);
  });

  it('returns no users for a dump holding only a users list or unknown keys', () => {
    expect(parseLegacyBackup({ tytax_mystery: 'x' }).users).toEqual([]);
    expect(parseLegacyBackup({ tytax_users_list: '[]' }).users).toEqual([]);
  });

  it('bodyweight rejects zero and bad dates', () => {
    const b = parseLegacyBackup({ tytax_bodyweight_log: [{ date: '2025-01-01', value: 0 }, { date: 'x', value: 70 }, { value: 70 }] });
    expect(b.users[0]?.bodyweight).toEqual([]);
    expect(b.warnings).toHaveLength(3);
  });
});
