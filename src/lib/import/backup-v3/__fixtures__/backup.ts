/** Synthetic, deterministic BackupV3 for tests. No real user data. */
import { buildProfile, buildWorkoutLog, sequentialIds } from '@/contracts';
import type { BackupV3, Program } from '@/contracts';

export const FIXTURE_NOW = new Date('2026-03-15T09:30:00.000Z');

export function buildBackup(): BackupV3 {
  const nextId = sequentialIds('fx');
  const stamp = FIXTURE_NOW.toISOString();
  const ana = buildProfile({ name: 'Ana' }, FIXTURE_NOW, nextId);
  const marko = { ...buildProfile({ name: 'Marko', settings: { units: 'lb' } }, FIXTURE_NOW, nextId), gender: 'male' as const };
  const program: Program = {
    id: nextId(), profileId: ana.id, name: 'Upper/Lower', splitType: 'upper_lower', frequency: 4,
    periodizationType: 'linear', periodizationConfig: { type: 'linear', linearIncrement: 2.5, linearFrequencyWeeks: 1 },
    sessionOrder: ['Upper', 'Lower'], modalitiesUsed: ['tytax'], isPreset: false, currentSessionIndex: 1,
    rotationStartDate: '2026-03-01', createdAt: stamp, updatedAt: stamp,
    sessions: [
      { id: 'sess-u', programId: '', name: 'Upper', dayIndex: 0, exercises: [
        { exerciseId: 'bench', exerciseName: 'Bench', modality: 'tytax', sets: 3, reps: '8-12', restSeconds: 90 },
      ] },
      { id: 'sess-r', programId: '', name: 'Rest', dayIndex: 1, exercises: [], isRest: true },
    ],
  };
  program.sessions.forEach((s) => { s.programId = program.id; });
  const log = buildWorkoutLog(ana.id, {
    daysAgo: 2, programId: program.id, programSessionId: 'sess-u', rpe: 8, notes: 'felt good',
    exercises: [
      { exerciseId: 'bench', exerciseName: 'Bench', sets: [{ kg: 20, reps: 10, type: 'warmup' }, { kg: 60, reps: 8, rir: 2 }] },
      { exerciseId: 'swing', modality: 'kettlebell', sets: [{ kg: 16, reps: 15, done: false }] },
    ],
  }, FIXTURE_NOW, nextId);
  const deletedLog = buildWorkoutLog(marko.id, { daysAgo: 5, deleted: true, exercises: [] }, FIXTURE_NOW, nextId);
  return {
    format: 'tytax-backup', version: 3, exportedAt: stamp,
    profiles: [{ ...ana, activeProgramId: program.id }, marko],
    workoutLogs: [log, deletedLog],
    programs: [program],
    prRecords: [{
      id: nextId(), profileId: ana.id, exerciseId: 'bench', exerciseName: 'Bench', prType: 'e1rm', value: 76,
      kg: 60, reps: 8, achievedAt: log.finishedAt, workoutLogId: log.id, setId: log.exercises[0].sets[1].id,
      createdAt: stamp, updatedAt: stamp,
    }],
    bodyweightEntries: [{ id: nextId(), profileId: marko.id, date: '2026-03-14', valueKg: 82.4, createdAt: stamp, updatedAt: stamp }],
    exerciseNotes: [{ id: nextId(), profileId: ana.id, exerciseId: 'bench', content: 'Elbows 45°', createdAt: stamp, updatedAt: stamp }],
    arsenal: [{ id: nextId(), profileId: ana.id, exerciseId: 'swing', addedAt: stamp, updatedAt: stamp, deletedAt: stamp }],
    equipment: [{
      id: marko.id, profileId: marko.id, stationIds: ['SMITH'], attachmentIds: ['rope'], kettlebellsKg: [16, 24],
      bodyweightGear: ['pull-up-bar', 'rings'], createdAt: stamp, updatedAt: stamp,
    }],
  };
}
