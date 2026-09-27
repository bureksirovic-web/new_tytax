/**
 * Cross-record invariants of a schema-valid BackupV3 (src/contracts/domain.ts).
 *
 * Structural corruption is rejected (ImportError INVALID_STRUCTURE):
 * - duplicate `SessionExercise.uid` within one workout log;
 * - an EquipmentInventory row whose `id !== profileId` (one row per profile);
 * - a ProgramSession whose `programId` is not its program's id.
 *
 * Derived or pointer fields are repaired in place with an INVALID_VALUE warning,
 * so a backup written by a buggy build still restores:
 * - `Profile.activeProgramId` naming a program that is missing from the backup
 *   or owned by another profile -> null;
 * - `Program.currentSessionIndex` outside `sessions` -> clamped;
 * - `WorkoutLog.totalSets` / `totalVolumeKg` disagreeing with the done working
 *   sets -> recomputed with the repo's own `computeTotals`, so a time-measured
 *   set counts in totalSets but adds no kg volume (as `finishWorkout` stores it).
 */
import type { BackupV3, Program, WorkoutLog } from '@/contracts';
import { ImportError } from '../errors';
import { computeTotals } from '@/lib/db/repo/logs';
import type { ImportWarning } from '../types';

/** Tolerance for a recorded totalVolumeKg vs the recomputed sum: the repo rounds to 0.01 kg. */
const VOLUME_EPSILON = 0.01;

function assertUniqueUids(log: WorkoutLog, i: number): void {
  const seen = new Set<string>();
  log.exercises.forEach((ex, j) => {
    if (seen.has(ex.uid)) {
      throw new ImportError(
        'INVALID_STRUCTURE',
        `Duplicate exercise uid "${ex.uid}" in workoutLogs[${i}]`,
        `workoutLogs[${i}].exercises[${j}].uid`,
      );
    }
    seen.add(ex.uid);
  });
}

function assertStructure(backup: BackupV3): void {
  backup.workoutLogs.forEach(assertUniqueUids);
  backup.equipment.forEach((row, i) => {
    if (row.id !== row.profileId) {
      throw new ImportError(
        'INVALID_STRUCTURE',
        `equipment[${i}].id must equal its profileId (one inventory per profile)`,
        `equipment[${i}].id`,
      );
    }
  });
  backup.programs.forEach((program, i) => {
    program.sessions.forEach((session, k) => {
      if (session.programId !== program.id) {
        throw new ImportError(
          'INVALID_STRUCTURE',
          `programs[${i}].sessions[${k}] belongs to program "${session.programId}", not "${program.id}"`,
          `programs[${i}].sessions[${k}].programId`,
        );
      }
    });
  });
}

function repairActivePrograms(backup: BackupV3, warnings: ImportWarning[]): void {
  const owner = new Map<string, string>(backup.programs.map((p) => [p.id, p.profileId]));
  backup.profiles.forEach((profile, i) => {
    const active = profile.activeProgramId;
    if (active === null || owner.get(active) === profile.id) return;
    profile.activeProgramId = null;
    warnings.push({
      code: 'INVALID_VALUE',
      path: `profiles[${i}].activeProgramId`,
      message: `Active program "${active}" is not a program of this profile; cleared`,
    });
  });
}

function repairSessionIndex(program: Program, i: number, warnings: ImportWarning[]): void {
  const max = Math.max(program.sessions.length - 1, 0);
  if (program.currentSessionIndex <= max) return;
  warnings.push({
    code: 'INVALID_VALUE',
    path: `programs[${i}].currentSessionIndex`,
    message: `Session index ${program.currentSessionIndex} is outside ${program.sessions.length} sessions; clamped to ${max}`,
  });
  program.currentSessionIndex = max;
}

function repairTotals(log: WorkoutLog, i: number, warnings: ImportWarning[]): void {
  const { totalSets, totalVolumeKg } = computeTotals(log.exercises);
  const setsOk = log.totalSets === totalSets;
  const volumeOk = Math.abs(log.totalVolumeKg - totalVolumeKg) <= VOLUME_EPSILON;
  if (setsOk && volumeOk) return;
  warnings.push({
    code: 'INVALID_VALUE',
    path: `workoutLogs[${i}]`,
    message:
      `Totals (${log.totalSets} sets, ${log.totalVolumeKg} kg) disagree with the done working sets ` +
      `(${totalSets} sets, ${totalVolumeKg} kg); recomputed`,
  });
  log.totalSets = totalSets;
  log.totalVolumeKg = totalVolumeKg;
}

/**
 * Rejects structural corruption, then repairs derived/pointer fields in place.
 * @throws ImportError INVALID_STRUCTURE
 */
export function enforceInvariants(backup: BackupV3, warnings: ImportWarning[]): void {
  assertStructure(backup);
  repairActivePrograms(backup, warnings);
  backup.programs.forEach((p, i) => repairSessionIndex(p, i, warnings));
  backup.workoutLogs.forEach((log, i) => repairTotals(log, i, warnings));
}
