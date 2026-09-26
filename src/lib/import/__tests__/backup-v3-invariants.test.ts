/**
 * Contract invariants (src/contracts/domain.ts) that parseBackupV3 enforces
 * beyond the per-field schema: UTC timestamps, documented ranges and
 * cross-record consistency. Converted from refuter reproductions.
 */
import { describe, expect, it } from 'vitest';
import type { BackupV3 } from '@/contracts';
import { isImportError } from '../errors';
import type { ImportError } from '../errors';
import { parseBackupV3, serializeBackupV3 } from '../backup-v3';
import type { ParsedBackupV3 } from '../backup-v3';
import { buildBackup } from '../backup-v3/__fixtures__/backup';

function parseMutated(mut: (b: BackupV3) => void): ParsedBackupV3 {
  const b = buildBackup();
  mut(b);
  return parseBackupV3(serializeBackupV3(b));
}

function rejection(mut: (b: BackupV3) => void): ImportError {
  try {
    parseMutated(mut);
  } catch (e) {
    if (isImportError(e)) return e;
    throw e;
  }
  throw new Error('expected parseBackupV3 to throw');
}

describe('backup-v3 timestamps are stored as UTC toISOString() strings', () => {
  it('rewrites a +02:00 offset to UTC so it sorts before a later UTC stamp', () => {
    const { backup } = parseMutated((b) => {
      b.profiles[0].updatedAt = '2026-03-15T11:30:00.000+02:00';
    });
    expect(backup.profiles[0].updatedAt).toBe('2026-03-15T09:30:00.000Z');
    expect(backup.profiles[0].updatedAt < '2026-03-15T10:00:00.000Z').toBe(true);
  });

  it('pads a second-precision stamp to milliseconds so it sorts before a later ms stamp', () => {
    const { backup } = parseMutated((b) => {
      b.profiles[0].updatedAt = '2026-03-15T09:30:00Z';
      b.workoutLogs[0].exercises[0].sets[1].completedAt = '2026-03-15T09:30:00.1234Z';
    });
    expect(backup.profiles[0].updatedAt).toBe('2026-03-15T09:30:00.000Z');
    expect(backup.profiles[0].updatedAt < '2026-03-15T09:30:00.500Z').toBe(true);
    expect(backup.workoutLogs[0].exercises[0].sets[1].completedAt).toBe('2026-03-15T09:30:00.123Z');
  });

  it('rejects a well-formed but impossible date (Feb 30) instead of rolling it over', () => {
    const err = rejection((b) => { b.profiles[0].updatedAt = '2026-02-30T10:00:00.000Z'; });
    expect(err.code).toBe('INVALID_STRUCTURE');
    expect(err.path).toBe('profiles[0].updatedAt');
  });
});

describe('backup-v3 documented ranges', () => {
  it.each([
    ['SetEntry.rir 99 (0–5)', (b: BackupV3) => { b.workoutLogs[0].exercises[0].sets[1].rir = 99; }, 'workoutLogs[0].exercises[0].sets[1].rir'],
    ['SetEntry.rir -1 (0–5)', (b: BackupV3) => { b.workoutLogs[0].exercises[0].sets[1].rir = -1; }, 'workoutLogs[0].exercises[0].sets[1].rir'],
    ['WorkoutLog.rpe 50 (1–10)', (b: BackupV3) => { b.workoutLogs[0].rpe = 50; }, 'workoutLogs[0].rpe'],
    ['WorkoutLog.rpe 0 (1–10)', (b: BackupV3) => { b.workoutLogs[0].rpe = 0; }, 'workoutLogs[0].rpe'],
    [
      'MuscleImpact.score 500 (0–100)',
      (b: BackupV3) => { b.workoutLogs[0].exercises[0].muscleImpactSnapshot = [{ muscle: 'CHEST', score: 500 }]; },
      'workoutLogs[0].exercises[0].muscleImpactSnapshot[0].score',
    ],
    ['negative totalVolumeKg', (b: BackupV3) => { b.workoutLogs[0].totalVolumeKg = -1; }, 'workoutLogs[0].totalVolumeKg'],
  ])('rejects %s as INVALID_STRUCTURE', (_label, mut, path) => {
    const err = rejection(mut);
    expect(err.code).toBe('INVALID_STRUCTURE');
    expect(err.path).toBe(path);
  });

  it('accepts the range bounds rir 0/5, rpe 1/10, score 0/100', () => {
    const { backup } = parseMutated((b) => {
      b.workoutLogs[0].exercises[0].sets[1].rir = 5;
      b.workoutLogs[0].exercises[0].sets[0].rir = 0;
      b.workoutLogs[0].rpe = 10;
      b.workoutLogs[1].rpe = 1;
      b.workoutLogs[0].exercises[0].muscleImpactSnapshot = [{ muscle: 'CHEST', score: 100 }, { muscle: 'TRICEPS', score: 0 }];
    });
    expect(backup.workoutLogs[0].exercises[0].sets.map((s) => s.rir)).toEqual([0, 5]);
    expect([backup.workoutLogs[0].rpe, backup.workoutLogs[1].rpe]).toEqual([10, 1]);
  });
});

describe('backup-v3 structural invariants are rejected', () => {
  it.each([
    [
      'a duplicate SessionExercise.uid within one log',
      (b: BackupV3) => { b.workoutLogs[0].exercises[1].uid = b.workoutLogs[0].exercises[0].uid; },
      'workoutLogs[0].exercises[1].uid',
    ],
    ['an EquipmentInventory row whose id !== profileId', (b: BackupV3) => { b.equipment[0].id = 'not-the-profile-id'; }, 'equipment[0].id'],
    [
      'a second EquipmentInventory row for one profile',
      (b: BackupV3) => { b.equipment.push({ ...b.equipment[0], id: 'second-row' }); },
      'equipment[1].id',
    ],
    ['a ProgramSession owned by another program', (b: BackupV3) => { b.programs[0].sessions[1].programId = 'other'; }, 'programs[0].sessions[1].programId'],
  ])('rejects %s', (_label, mut, path) => {
    const err = rejection(mut);
    expect(err.code).toBe('INVALID_STRUCTURE');
    expect(err.path).toBe(path);
  });

  it('allows the same uid in two different logs', () => {
    const { backup } = parseMutated((b) => {
      b.workoutLogs[1].exercises = [structuredClone(b.workoutLogs[0].exercises[1])];
    });
    expect(backup.workoutLogs[1].exercises[0].uid).toBe(backup.workoutLogs[0].exercises[1].uid);
  });
});

describe('backup-v3 pointer and derived fields are repaired with a warning', () => {
  it("clears Profile.activeProgramId pointing at another profile's program", () => {
    const { backup, warnings } = parseMutated((b) => { b.profiles[1].activeProgramId = b.programs[0].id; });
    expect(backup.profiles[1].activeProgramId).toBeNull();
    expect(backup.profiles[0].activeProgramId).toBe(backup.programs[0].id);
    expect(warnings).toEqual([expect.objectContaining({ code: 'INVALID_VALUE', path: 'profiles[1].activeProgramId' })]);
  });

  it('clears Profile.activeProgramId naming a program missing from the backup', () => {
    const { backup, warnings } = parseMutated((b) => { b.profiles[0].activeProgramId = 'ghost'; });
    expect(backup.profiles[0].activeProgramId).toBeNull();
    expect(warnings.map((w) => w.path)).toEqual(['profiles[0].activeProgramId']);
  });

  it('clamps Program.currentSessionIndex 99 to the last of 2 sessions', () => {
    const { backup, warnings } = parseMutated((b) => { b.programs[0].currentSessionIndex = 99; });
    expect(backup.programs[0].currentSessionIndex).toBe(1);
    expect(warnings).toEqual([expect.objectContaining({ code: 'INVALID_VALUE', path: 'programs[0].currentSessionIndex' })]);
  });

  it('clamps currentSessionIndex to 0 for a program without sessions', () => {
    const { backup } = parseMutated((b) => {
      b.programs[0].sessions = [];
      b.programs[0].currentSessionIndex = 3;
    });
    expect(backup.programs[0].currentSessionIndex).toBe(0);
  });

  it('recomputes totalSets/totalVolumeKg from done working sets when they disagree', () => {
    const { backup, warnings } = parseMutated((b) => {
      b.workoutLogs[0].totalSets = 99;
      b.workoutLogs[0].totalVolumeKg = 12345;
    });
    // Done working sets in the fixture: bench 60 kg x 8 (warm-up and undone swing excluded).
    expect(backup.workoutLogs[0].totalSets).toBe(1);
    expect(backup.workoutLogs[0].totalVolumeKg).toBe(480);
    expect(warnings).toEqual([expect.objectContaining({ code: 'INVALID_VALUE', path: 'workoutLogs[0]' })]);
  });

  it('keeps totals within float tolerance untouched and warns about nothing', () => {
    const { backup, warnings } = parseMutated((b) => { b.workoutLogs[0].totalVolumeKg = 480.0004; });
    expect(backup.workoutLogs[0].totalVolumeKg).toBe(480.0004);
    expect(warnings).toEqual([]);
  });
});
