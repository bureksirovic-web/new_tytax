import { describe, expect, it } from 'vitest';
import { parseBackupV3, serializeBackupV3, backupV3Schema, formatIssuePath } from '../backup-v3';
import { buildBackup } from '../backup-v3/__fixtures__/backup';

describe('BackupV3 round trip', () => {
  it('serialize -> parse yields a deep-equal backup with no warnings', () => {
    const original = buildBackup();
    const { backup, warnings } = parseBackupV3(serializeBackupV3(original));
    expect(backup).toEqual(original);
    expect(warnings).toEqual([]);
  });

  it('keeps soft-deleted rows and nullable/optional fields', () => {
    const { backup } = parseBackupV3(serializeBackupV3(buildBackup()));
    expect(backup.workoutLogs[1].deletedAt).toBeDefined();
    expect(backup.arsenal[0].deletedAt).toBeDefined();
    expect(backup.profiles[1].activeProgramId).toBeNull();
    expect(backup.workoutLogs[0].exercises[0].sets[1].rir).toBe(2);
    expect('rir' in backup.workoutLogs[0].exercises[0].sets[0]).toBe(false);
  });

  it('accepts an already-parsed object and returns a fresh copy', () => {
    const original = buildBackup();
    const { backup } = parseBackupV3(original);
    expect(backup).toEqual(original);
    expect(backup).not.toBe(original);
    expect(backup.profiles[0]).not.toBe(original.profiles[0]);
  });

  it('is idempotent: parse(serialize(parse(x))) serializes identically', () => {
    const once = serializeBackupV3(parseBackupV3(serializeBackupV3(buildBackup())).backup);
    const twice = serializeBackupV3(parseBackupV3(once).backup);
    expect(twice).toBe(once);
  });

  it('accepts an empty backup (no profiles, no records)', () => {
    const empty = { ...buildBackup(), profiles: [], workoutLogs: [], programs: [], prRecords: [],
      bodyweightEntries: [], exerciseNotes: [], arsenal: [], equipment: [] };
    expect(parseBackupV3(serializeBackupV3(empty)).backup).toEqual(empty);
  });
});

describe('BackupV3 tolerance', () => {
  it('strips unknown extra fields at every level', () => {
    const raw = JSON.parse(serializeBackupV3(buildBackup())) as Record<string, unknown> & {
      profiles: Array<Record<string, unknown> & { settings: Record<string, unknown> }>;
      workoutLogs: Array<{ exercises: Array<{ sets: Array<Record<string, unknown>> }> }>;
    };
    raw.futureTable = [{ id: 'x' }];
    raw.profiles[0].nickname = 'A';
    raw.profiles[0].settings.hapticFeedback = true;
    raw.workoutLogs[0].exercises[0].sets[0].velocity = 0.8;
    const { backup } = parseBackupV3(JSON.stringify(raw));
    expect(backup).toEqual(buildBackup());
    expect(Object.keys(backup)).not.toContain('futureTable');
    expect(Object.keys(backup.profiles[0])).not.toContain('nickname');
  });

  it('accepts a timestamp with a UTC offset and normalises it to toISOString() form', () => {
    const b = buildBackup();
    b.exportedAt = '2026-03-15T11:30:00+02:00';
    expect(parseBackupV3(serializeBackupV3(b)).backup.exportedAt).toBe('2026-03-15T09:30:00.000Z');
  });
});

describe('serializeBackupV3', () => {
  it('emits keys in sorted order at every level regardless of insertion order', () => {
    const b = buildBackup();
    const reordered = { ...b, profiles: b.profiles.map((p) => Object.fromEntries(Object.entries(p).reverse()) as typeof p) };
    expect(serializeBackupV3(reordered)).toBe(serializeBackupV3(b));
    const text = serializeBackupV3(b);
    expect(text.indexOf('"arsenal"')).toBeLessThan(text.indexOf('"version"'));
    expect(text.startsWith('{"arsenal":')).toBe(true);
  });

  it('keeps array order and omits undefined optionals', () => {
    const text = serializeBackupV3(buildBackup());
    expect(text).not.toContain('undefined');
    expect(text).not.toContain('"rir":null');
    const parsed = JSON.parse(text) as { profiles: Array<{ name: string }> };
    expect(parsed.profiles.map((p) => p.name)).toEqual(['Ana', 'Marko']);
  });

  it('pretty-prints with two-space indentation on request', () => {
    const text = serializeBackupV3(buildBackup(), { pretty: true });
    expect(text.split('\n')[1]).toMatch(/^ {2}"arsenal": \[/);
    expect(JSON.parse(text)).toEqual(JSON.parse(serializeBackupV3(buildBackup())));
  });

  it('the schema also validates the fixture directly', () => {
    expect(backupV3Schema.safeParse(buildBackup()).success).toBe(true);
  });
});

describe('formatIssuePath', () => {
  it('renders mixed keys and indices', () => {
    expect(formatIssuePath(['workoutLogs', 0, 'exercises', 1, 'kg'])).toBe('workoutLogs[0].exercises[1].kg');
    expect(formatIssuePath([])).toBe('');
    expect(formatIssuePath([2, 'a'])).toBe('[2].a');
  });
});
