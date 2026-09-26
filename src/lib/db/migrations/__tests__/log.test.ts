import { describe, expect, it } from 'vitest';
import type { WorkoutLog } from '@/contracts';
import { migrateLogV2 } from '../log';
import { CTX, set, v2FamilyLog, v2Log } from './fixture';

const ts = (n: number) => `2026-03-01T09:0${n}:00.000Z`;

describe('migrateLogV2', () => {
  it('maps a v2 log to the exact v3 shape', () => {
    const expected: WorkoutLog = {
      id: 'log-1',
      profileId: 'local',
      programId: 'p-2',
      sessionName: 'Push A',
      date: '2026-03-01',
      startedAt: '2026-03-01T09:00:00.000Z',
      finishedAt: '2026-03-01T10:00:00.000Z',
      durationSeconds: 3600,
      exercises: [
        {
          uid: 'log-1:0',
          exerciseId: 'bench',
          exerciseName: 'Bench Press',
          modality: 'tytax',
          restSeconds: 120,
          sets: [
            { id: 's-1', type: 'warmup', kg: 20, reps: 10, done: true, completedAt: ts(1) },
            { id: 's-2', type: 'working', kg: 60, reps: 8, rir: 2, done: true, completedAt: ts(2), tempo: '3-1-1-0' },
            { id: 's-3', type: 'working', kg: 62.5, reps: 6, rir: 5, done: true, completedAt: ts(3), isPR: true, e1rm: 74.5 },
            { id: 's-4', type: 'working', kg: 65, reps: 5, done: false },
          ],
        },
        {
          uid: 'log-1:1',
          exerciseId: 'kb-swing',
          exerciseName: 'KB Swing',
          modality: 'kettlebell',
          sets: [{ id: 's-5', type: 'working', kg: 24, reps: 15, done: true, completedAt: ts(5) }],
        },
        {
          uid: 'log-1:2',
          exerciseId: 'bench',
          exerciseName: 'Bench Press',
          modality: 'custom',
          supersetGroup: 'A',
          sets: [
            { id: 's-6', type: 'working', kg: 50, reps: 10, rir: 0, done: true, completedAt: ts(6) },
            { id: 's-7', type: 'drop', kg: 40, reps: 8, done: true, completedAt: ts(7) },
          ],
        },
      ],
      // Done non-warm-up sets: 60×8=480, 62.5×6=375, 24×15=360, 50×10=500, 40×8=320
      // → 480+375+360+500+320 = 2035 over 5 sets. Excluded: warm-up 20×10=200 and
      // not-done 65×5. Legacy stored 2235 / 6 (it counted the warm-up).
      totalVolumeKg: 2035,
      totalSets: 5,
      prCount: 1,
      modalitiesUsed: ['tytax', 'kettlebell', 'custom'],
      createdAt: '2026-03-01T10:00:00.000Z',
      updatedAt: '2026-03-01T10:00:00.000Z',
    };
    expect(migrateLogV2(v2Log(), CTX)).toStrictEqual(expected);
  });

  it('keeps a duplicated exercise twice with distinct uids', () => {
    const out = migrateLogV2(v2Log(), CTX);
    const bench = out.exercises.filter((e) => e.exerciseId === 'bench');
    expect(bench.map((e) => e.uid)).toEqual(['log-1:0', 'log-1:2']);
    expect(new Set(out.exercises.map((e) => e.uid)).size).toBe(out.exercises.length);
  });

  it('defaults finishedAt to startedAt + duration and updatedAt to createdAt; drops familyMemberId', () => {
    const out = migrateLogV2(v2FamilyLog(), CTX);
    expect(out.finishedAt).toBe('2026-03-02T10:30:00.000Z');
    expect(out.updatedAt).toBe('2026-03-02T10:30:00.000Z');
    expect('familyMemberId' in out).toBe(false);
  });

  it('is idempotent: v3 input comes back unchanged', () => {
    const once = migrateLogV2(v2Log(), CTX);
    const snapshot = structuredClone(once);
    const twice = migrateLogV2(once, CTX);
    expect(twice).toBe(once);
    expect(twice).toStrictEqual(snapshot);
  });

  it('coerces broken v2 values', () => {
    const log = v2FamilyLog();
    log.exercises = [
      {
        exerciseRef: 'x',
        exerciseName: '',
        modality: 'Bodyweight ',
        sets: [set(1, { id: '', kg: Number.NaN, reps: 5, done: true, timestamp: '' }), set(2, { e1rm: Number.POSITIVE_INFINITY })],
      },
    ];
    log.durationSeconds = Number.NaN;
    log.startedAt = 'not-a-date';
    log.sessionName = '';
    log.date = '';
    const out = migrateLogV2(log, CTX);
    const ex = out.exercises[0];
    expect(ex.exerciseName).toBe('x');
    expect(ex.modality).toBe('bodyweight');
    expect(ex.sets[0]).toStrictEqual({ id: 'log-2:0:0', type: 'working', kg: 0, reps: 5, done: true });
    expect(ex.sets[1].e1rm).toBeUndefined();
    expect(out.durationSeconds).toBe(0);
    expect(out.finishedAt).toBe('not-a-date');
    expect(out.sessionName).toBe('Quick Workout');
    expect(out.date).toBe('not-a-date');
  });

  it('keeps legacy modalities for a log with no exercises and fills missing timestamps from ctx', () => {
    const log = v2FamilyLog();
    log.exercises = [];
    log.modalitiesUsed = ['kettlebell', 'KETTLEBELL', 'yoga'];
    log.startedAt = '';
    log.createdAt = '';
    const out = migrateLogV2(log, CTX);
    expect(out.modalitiesUsed).toEqual(['kettlebell', 'custom']);
    expect(out.startedAt).toBe(CTX.now);
    expect(out.createdAt).toBe(CTX.now);
    expect(out.date).toBe('2026-03-02');
    expect(out.totalVolumeKg).toBe(0);
  });
});
