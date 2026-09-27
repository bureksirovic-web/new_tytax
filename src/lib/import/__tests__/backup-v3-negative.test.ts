import { describe, expect, it } from 'vitest';
import type { BackupV3 } from '@/contracts';
import { ImportError, isImportError } from '../errors';
import { utf8ByteLength } from '../safe-json';
import { DEFAULT_MAX_BYTES } from '../types';
import type { ImportErrorCode } from '../errors';
import { parseBackupV3, serializeBackupV3 } from '../backup-v3';
import { buildBackup } from '../backup-v3/__fixtures__/backup';

function errorOf(fn: () => unknown): ImportError {
  try {
    fn();
  } catch (e) {
    if (isImportError(e)) return e;
    throw e;
  }
  throw new Error('expected an ImportError');
}

function expectError(input: unknown, code: ImportErrorCode, path?: string): ImportError {
  const err = errorOf(() => parseBackupV3(input));
  expect(err.code).toBe(code);
  if (path !== undefined) expect(err.path).toBe(path);
  return err;
}

function mutated(fn: (b: BackupV3) => void): string {
  const b = buildBackup();
  fn(b);
  return serializeBackupV3(b);
}

describe('parseBackupV3 envelope', () => {
  it.each([
    ['wrong version 2', { ...buildBackup(), version: 2 }, 'version'],
    ['version as string', { ...buildBackup(), version: '3' }, 'version'],
    ['missing version', { ...buildBackup(), version: undefined }, 'version'],
    ['wrong format tag', { ...buildBackup(), format: 'tytax-export' }, 'format'],
    ['missing format tag', { ...buildBackup(), format: undefined }, 'format'],
  ])('rejects %s as UNRECOGNIZED_FORMAT', (_label, input, path) => {
    expectError(JSON.stringify(input), 'UNRECOGNIZED_FORMAT', path);
  });

  it.each([['array', '[]'], ['null', 'null'], ['number', '3'], ['string', '"x"']])('rejects a top-level %s', (_l, text) => {
    expectError(text, 'UNRECOGNIZED_FORMAT');
  });

  it('rejects a legacy app backup as UNRECOGNIZED_FORMAT', () => {
    expectError(JSON.stringify({ logs: [], sessionOrder: [] }), 'UNRECOGNIZED_FORMAT', 'format');
  });

  it('rejects malformed JSON as INVALID_JSON', () => {
    expectError('{"format":"tytax-backup",', 'INVALID_JSON');
  });
});

describe('parseBackupV3 schema', () => {
  it.each<[string, (b: BackupV3) => void, string]>([
    ['unknown set type', (b) => { Object.assign(b.workoutLogs[0].exercises[0].sets[0], { type: 'amrap' }); }, 'workoutLogs[0].exercises[0].sets[0].type'],
    ['unknown modality', (b) => { Object.assign(b.workoutLogs[0].exercises[1], { modality: 'band' }); }, 'workoutLogs[0].exercises[1].modality'],
    ['missing kg', (b) => { Reflect.deleteProperty(b.workoutLogs[0].exercises[0].sets[1], 'kg'); }, 'workoutLogs[0].exercises[0].sets[1].kg'],
    ['kg as string', (b) => { Object.assign(b.workoutLogs[0].exercises[0].sets[1], { kg: '60' }); }, 'workoutLogs[0].exercises[0].sets[1].kg'],
    ['bad units setting', (b) => { Object.assign(b.profiles[0].settings, { units: 'stone' }); }, 'profiles[0].settings.units'],
    ['missing settings field', (b) => { Reflect.deleteProperty(b.profiles[1].settings, 'voiceCues'); }, 'profiles[1].settings.voiceCues'],
    ['bad calendar day', (b) => { b.bodyweightEntries[0].date = '14.03.2026'; }, 'bodyweightEntries[0].date'],
    ['bad timestamp', (b) => { b.programs[0].updatedAt = 'yesterday'; }, 'programs[0].updatedAt'],
    ['bad PR type', (b) => { Object.assign(b.prRecords[0], { prType: 'speed' }); }, 'prRecords[0].prType'],
    ['bad equipment gear', (b) => { Object.assign(b.equipment[0], { bodyweightGear: ['trx'] }); }, 'equipment[0].bodyweightGear[0]'],
    ['bad split type', (b) => { Object.assign(b.programs[0], { splitType: 'bro' }); }, 'programs[0].splitType'],
    ['missing table', (b) => { Reflect.deleteProperty(b, 'arsenal'); }, 'arsenal'],
    ['empty id', (b) => { b.exerciseNotes[0].id = ''; }, 'exerciseNotes[0].id'],
  ])('rejects %s as INVALID_STRUCTURE', (_label, mutate, path) => {
    const err = expectError(mutated(mutate), 'INVALID_STRUCTURE', path);
    expect(err.message).toContain(path);
  });

  it('summarises many issues in one message', () => {
    const text = mutated((b) => {
      b.workoutLogs[0].exercises[0].sets.forEach((s) => Object.assign(s, { type: 'x', done: 'yes' }));
      b.workoutLogs[0].exercises[1].sets.forEach((s) => Object.assign(s, { type: 'x', done: 'yes' }));
    });
    expect(expectError(text, 'INVALID_STRUCTURE').message).toMatch(/\(\+1 more\)$/);
  });
});

describe('parseBackupV3 cross-record checks', () => {
  it.each<[string, (b: BackupV3) => void, string]>([
    ['orphan workout log', (b) => { b.workoutLogs[0].profileId = 'ghost'; }, 'workoutLogs[0].profileId'],
    ['orphan equipment row', (b) => { b.equipment[0].profileId = 'ghost'; }, 'equipment[0].profileId'],
    ['orphan note', (b) => { b.exerciseNotes[0].profileId = 'ghost'; }, 'exerciseNotes[0].profileId'],
    ['duplicate profile id', (b) => { b.profiles[1].id = b.profiles[0].id; }, 'profiles[1].id'],
    ['duplicate log id', (b) => { b.workoutLogs[1].id = b.workoutLogs[0].id; }, 'workoutLogs[1].id'],
    ['duplicate PR id', (b) => { b.prRecords.push({ ...b.prRecords[0] }); }, 'prRecords[1].id'],
  ])('rejects %s as INVALID_STRUCTURE', (_label, mutate, path) => {
    expectError(mutated(mutate), 'INVALID_STRUCTURE', path);
  });

  it('allows the same id in different tables', () => {
    const text = mutated((b) => { b.bodyweightEntries[0].id = b.workoutLogs[0].id; });
    expect(parseBackupV3(text).backup.bodyweightEntries[0].id).toBe(buildBackup().workoutLogs[0].id);
  });
});

describe('parseBackupV3 safety', () => {
  const poisoned = (): string =>
    serializeBackupV3(buildBackup()).replace('"name":"Ana"', '"name":"Ana","__proto__":{"isAdmin":true}');

  it('strips a __proto__ payload with a warning and never pollutes prototypes', () => {
    const { backup, warnings } = parseBackupV3(poisoned());
    expect(warnings).toEqual([expect.objectContaining({ code: 'UNSAFE_KEY_STRIPPED', path: 'profiles[0].__proto__' })]);
    expect(Object.getPrototypeOf(backup.profiles[0])).toBe(Object.prototype);
    expect(Object.prototype.hasOwnProperty.call(backup.profiles[0], '__proto__')).toBe(false);
    expect(({} as Record<string, unknown>).isAdmin).toBeUndefined();
    expect(backup).toEqual(buildBackup());
  });

  it('throws UNSAFE_KEYS in throw mode', () => {
    const err = errorOf(() => parseBackupV3(poisoned(), { unsafeKeys: 'throw' }));
    expect(err.code).toBe('UNSAFE_KEYS');
  });

  it('strips constructor/prototype keys from an object input', () => {
    const b: Record<string, unknown> = { ...buildBackup() };
    Object.defineProperty(b, 'constructor', { value: { prototype: { polluted: true } }, enumerable: true });
    const { warnings } = parseBackupV3(b);
    expect(warnings.map((w) => w.path)).toEqual(['constructor']);
  });

  it('rejects oversize input before parsing', () => {
    const text = serializeBackupV3(buildBackup());
    const bytes = utf8ByteLength(text);
    expect(bytes).toBeGreaterThan(text.length);
    expect(errorOf(() => parseBackupV3(text, { maxBytes: bytes - 1 })).code).toBe('TOO_LARGE');
    expect(parseBackupV3(text, { maxBytes: bytes }).backup).toEqual(buildBackup());
    expectError(' '.repeat(DEFAULT_MAX_BYTES + 1), 'TOO_LARGE');
  });

  it('rejects nesting deeper than maxDepth', () => {
    expect(errorOf(() => parseBackupV3(serializeBackupV3(buildBackup()), { maxDepth: 4 })).code).toBe('TOO_LARGE');
    const deep = `{"format":"tytax-backup","version":3,"x":${'['.repeat(100)}${']'.repeat(100)}}`;
    expect(errorOf(() => parseBackupV3(deep)).code).toBe('TOO_LARGE');
  });
});
