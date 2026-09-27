import { describe, expect, it } from 'vitest';
import { parseLegacyBackup, type LegacyImportBundle, type LegacyUserData } from '..';
import { ALL_FIXTURES, APP_BACKUP, MULTI_USER_DUMP, SINGLE_USER_DUMP } from '../__fixtures__/expected';
import { loadFixtureText } from '../__fixtures__/load';

function parseFixture(file: string): LegacyImportBundle {
  return parseLegacyBackup(loadFixtureText(file));
}

function user(bundle: LegacyImportBundle, name: string): LegacyUserData {
  const u = bundle.users.find((x) => x.username === name);
  if (!u) throw new Error(`missing user ${name}`);
  return u;
}

describe('legacy-import: fixture counts', () => {
  it.each(ALL_FIXTURES)('$file yields the exact expected counts', (fx) => {
    const bundle = parseFixture(fx.file);
    expect(bundle.format).toBe(fx.format);
    expect(bundle.users.map((u) => u.username)).toEqual(Object.keys(fx.users));
    expect(bundle.shared.customProtocols).toHaveLength(fx.sharedCustomProtocols);
    expect(bundle.warnings).toHaveLength(fx.warnings);
    for (const [name, exp] of Object.entries(fx.users)) {
      const u = user(bundle, name);
      const exercises = u.logs.flatMap((l) => l.exercises);
      const sets = exercises.flatMap((e) => e.sets);
      expect(u.logs).toHaveLength(exp.logs);
      expect(exercises).toHaveLength(exp.exercises);
      expect(sets).toHaveLength(exp.sets);
      expect(sets.filter((s) => s.type === 'warmup')).toHaveLength(exp.warmupSets);
      expect(u.bodyweight).toHaveLength(exp.bodyweight);
      expect(u.customProtocols).toHaveLength(exp.customProtocols);
      expect(Object.keys(u.trainingPlan)).toHaveLength(exp.planSessions);
      expect(u.sessionOrder).toHaveLength(exp.sessionOrder);
      const skipped = bundle.warnings.filter((w) => w.code === 'INVALID_RECORD' && /^(tytax_logs[^[]*|logs)\[\d+\]/.test(w.path));
      const ownSkipped = skipped.filter((w) => fx.format === 'app-backup' || w.path.startsWith(name === 'default' ? 'tytax_logs[' : `tytax_logs_${name}[`));
      expect(ownSkipped).toHaveLength(exp.skippedLogs);
    }
  });
});

describe('legacy-import: multi-user dump', () => {
  const bundle = parseFixture(MULTI_USER_DUMP.file);
  const ana = user(bundle, 'Ana');

  it('coerces string numerics and keeps blank rir undefined', () => {
    const [bench, row] = ana.logs[0]?.exercises ?? [];
    expect(bench?.sets[0]).toEqual({ kg: 40, reps: 10, done: true, type: 'warmup' });
    expect(bench?.sets[1]).toEqual({ kg: 60, reps: 8, rir: 2, done: true, type: 'working' });
    expect(bench?.sets[2]).toEqual({ kg: 60, reps: 8, rir: 1, done: true, type: 'working' });
    expect(row?.sets[0]).toEqual({ kg: 50.5, reps: 10, done: true, type: 'working' });
    expect(ana.logs[0]?.rpe).toBe(8);
    expect(ana.logs[1]?.durationSeconds).toBe(4200);
  });

  it('drops blank not-done sets but keeps a blank done set as 0/0', () => {
    expect(ana.logs[0]?.exercises[0]?.sets).toHaveLength(3);
    const squat2 = ana.logs[1]?.exercises[2];
    expect(squat2?.sets[1]).toEqual({ kg: 0, reps: 0, done: true, type: 'working' });
  });

  it('preserves a duplicate exercise in one log, in order, with normalized names', () => {
    const names = ana.logs[1]?.exercises.map((e) => e.legacyName);
    expect(names).toEqual([
      'TYTAX T1 | Smith Back Squat',
      'TYTAX T1 | Smith Romanian Deadlift (RDL)',
      'TYTAX T1 | Smith Back Squat',
    ]);
  });

  it('skips the malformed log with a warning carrying code, path and message', () => {
    expect(bundle.warnings).toContainEqual({
      code: 'INVALID_RECORD',
      path: 'tytax_logs_Ana[2].date',
      message: 'Skipped: unreadable date "not-a-date"',
    });
    expect(ana.logs.map((l) => l.sourceId)).toEqual(['1735732800000', '1735905600000', 'log-ana-4']);
  });

  it('derives timestamps: epoch id = finish time, ISO date = start time', () => {
    expect(ana.logs[0]?.finishedAt).toBe('2025-01-01T12:00:00.000Z');
    expect(ana.logs[0]?.startedAt).toBe('2025-01-01T11:00:00.000Z');
    expect(ana.logs[2]?.date).toBe('2025-01-05');
    expect(ana.logs[2]?.startedAt).toBe('2025-01-05T17:30:00.000Z');
    expect(ana.logs[2]?.finishedAt).toBeUndefined();
    expect(ana.logs[2]?.isDeload).toBe(true);
    expect(ana.logs[2]?.notes).toBeUndefined();
  });

  it('reads per-user settings and device-global shared settings', () => {
    expect(ana.settings).toEqual({
      barWeightKg: 20,
      inventory: ['Lat Bar'],
      language: 'hr',
      oledMode: true,
      pinnedMetrics: ['Squat', 'Bench'],
      startDate: '2025-01-01',
      warmupStrategy: 'Heavy',
    });
    expect(bundle.shared.settings).toEqual({ language: 'hr', barWeightKg: 15 });
    expect(user(bundle, 'Marko Horvat').settings).toEqual({ language: 'en', warmupStrategy: 'Standard' });
  });

  it('treats un-suffixed leftovers as warnings and custom protocols as shared', () => {
    const codes = bundle.warnings.map((w) => `${w.code}:${w.path}`);
    expect(codes).toContain('LEGACY_LEFTOVER_IGNORED:tytax_logs');
    expect(codes).toContain('SHARED_CUSTOM_PROTOCOLS:tytax_custom_protocols');
    expect(bundle.shared.customProtocols[0]?.name).toBe('Shared Leftover');
    expect(ana.customProtocols[0]).toEqual({
      sourceId: 'custom_1735600000000',
      name: 'Ana Full Body',
      description: 'Synthetic protocol',
      plan: { 'Full A': ['TYTAX T1 | Smith Flat Bench Press', 'TYTAX T1 | Smith Back Squat'], 'Rest Day': [] },
      order: ['Full A', 'Rest Day'],
    });
  });

  it('parses bodyweight, coercing string values and skipping bad ones', () => {
    expect(ana.bodyweight).toEqual([
      { date: '2025-01-01', kg: 62.5 },
      { date: '2025-01-08', kg: 62.1 },
    ]);
  });
});

describe('legacy-import: single-user dump and app backup', () => {
  it('maps a pre-family dump (already-parsed values) to user "default"', () => {
    const bundle = parseFixture(SINGLE_USER_DUMP.file);
    const u = user(bundle, 'default');
    expect(u.logs[0]?.exercises.map((e) => e.legacyName)).toEqual([
      'TYTAX T1 | Smith Flat Bench Press',
      'TYTAX T1 | Smith Flat Bench Press',
    ]);
    expect(u.settings).toEqual({ barWeightKg: 20, oledMode: false, startDate: '2024-01-01', warmupStrategy: 'Pyramid' });
    expect(u.customProtocols[0]?.name).toBe('Solo Split');
  });

  it('reads the legacy Backup export, honouring backupUsername', () => {
    const bundle = parseLegacyBackup(loadFixtureText(APP_BACKUP.file), { backupUsername: 'Ana' });
    const u = user(bundle, 'Ana');
    expect(u.settings.inventory).toEqual(['Lat Bar', 'D-Handles']);
    expect(u.logs[1]?.exercises[0]?.sets.map((s) => s.type)).toEqual(['warmup', 'warmup', 'working']);
    expect(bundle.warnings[0]?.path).toBe('logs[2].session');
  });
});

describe('legacy-import: determinism', () => {
  it.each(ALL_FIXTURES)('$file: parsing twice gives deep-equal output', (fx) => {
    const text = loadFixtureText(fx.file);
    expect(parseLegacyBackup(text)).toEqual(parseLegacyBackup(text));
  });

  it.each(ALL_FIXTURES)('$file: text input and pre-parsed input give the same bundle', (fx) => {
    const text = loadFixtureText(fx.file);
    const parsed: unknown = JSON.parse(text);
    expect(parseLegacyBackup(parsed)).toStrictEqual(parseLegacyBackup(text));
  });
});
