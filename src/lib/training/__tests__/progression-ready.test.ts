import { describe, expect, it } from 'vitest';
import type { Exercise, WorkoutLog } from '@/contracts/domain';
import { isYouthProfile, readyToProgress, YOUTH_PROGRESSION_ALLOWLIST, type ProgressionSession } from '../progression-ready';
import { logEndingAt } from './helpers';

const DIP_ID = 'bw_upper_dip-support-hold';
const DIP_CHILD = 'bw_dip_parallel-bar-dip';
const RING_PARENT = 'bw_dip_parallel-bar-dip';
const RING_CHILD = 'bw_dip_ring-dip';
const PUSH_ID = 'bw_push_standard-push-up';
const PUSH_CHILD = 'bw_push_wide-push-up';
const LEAF_ID = 'bw_leaf_no-child';

function catalog(entries: Record<string, Exercise>) {
  return (id: string): Exercise | undefined => entries[id];
}

function repsExercise(id: string, childId: string | undefined, defaultReps = '10-30s'): Exercise {
  return {
    id,
    name: id,
    modality: 'bodyweight',
    muscleGroup: 'TRICEPS',
    pattern: 'test',
    isUnilateral: false,
    defaultSets: 3,
    defaultReps,
    measure: defaultReps.endsWith('s') ? 'time' : 'reps',
    impact: [],
    progressionChildIds: childId ? [childId] : undefined,
  };
}

const NOW = new Date('2026-09-27T10:00:00Z');

/** Turns a `WorkoutLog` into the narrower shape `readyToProgress` needs. */
function asSession(log: WorkoutLog): ProgressionSession {
  return { id: log.id, exercises: log.exercises, isDeload: log.isDeload, deletedAt: log.deletedAt };
}

function timeLog(hoursAgo: number, exerciseId: string, seconds: number, done = true, extra: Partial<WorkoutLog> = {}): ProgressionSession {
  const log = logEndingAt(NOW, hoursAgo, [{ exerciseId, sets: [{ kg: 0, reps: 0, durationSeconds: seconds, done }] }]);
  return { ...asSession(log), ...extra };
}

function repsLog(hoursAgo: number, exerciseId: string, reps: number, done = true, extra: Partial<WorkoutLog> = {}): ProgressionSession {
  const log = logEndingAt(NOW, hoursAgo, [{ exerciseId, sets: [{ kg: 0, reps, done }] }]);
  return { ...asSession(log), ...extra };
}

describe('readyToProgress', () => {
  const lookup = catalog({
    [DIP_ID]: repsExercise(DIP_ID, DIP_CHILD, '10-30s'),
    [RING_PARENT]: repsExercise(RING_PARENT, RING_CHILD, '6-12'),
    [PUSH_ID]: repsExercise(PUSH_ID, PUSH_CHILD, '8-15'),
    [LEAF_ID]: repsExercise(LEAF_ID, undefined),
  });

  it('ready after 2 qualifying sessions (time set, top of range)', () => {
    const logs = [timeLog(24, DIP_ID, 30), timeLog(72, DIP_ID, 35)];
    const r = readyToProgress({ exerciseId: DIP_ID, logs, target: '10-30s', youth: false, catalogLookup: lookup });
    expect(r).toEqual({ ready: true, nextExerciseId: DIP_CHILD, reason: 'ready' });
  });

  it('not ready after only 1 qualifying session', () => {
    const logs = [timeLog(24, DIP_ID, 30)];
    const r = readyToProgress({ exerciseId: DIP_ID, logs, target: '10-30s', youth: false, catalogLookup: lookup });
    expect(r.ready).toBe(false);
    expect(r.reason).toBe('not-enough-sessions');
  });

  it('not ready if any working set of the 2 most recent sessions missed the top of range', () => {
    const logs = [timeLog(24, DIP_ID, 30), timeLog(72, DIP_ID, 20)]; // 20s < 30s top
    const r = readyToProgress({ exerciseId: DIP_ID, logs, target: '10-30s', youth: false, catalogLookup: lookup });
    expect(r.ready).toBe(false);
    expect(r.reason).toBe('sets-below-target');
  });

  it('an undone set never counts, even at the top value', () => {
    const logs = [timeLog(24, DIP_ID, 30, false), timeLog(72, DIP_ID, 30)];
    const r = readyToProgress({ exerciseId: DIP_ID, logs, target: '10-30s', youth: false, catalogLookup: lookup });
    expect(r.ready).toBe(false);
    expect(r.reason).toBe('sets-below-target');
  });

  it('reps-set variant: ready when both sessions reach the top rep count', () => {
    const logs = [repsLog(24, PUSH_ID, 15), repsLog(72, PUSH_ID, 15)];
    const r = readyToProgress({ exerciseId: PUSH_ID, logs, target: '8-15', youth: false, catalogLookup: lookup });
    expect(r).toEqual({ ready: true, nextExerciseId: PUSH_CHILD, reason: 'ready' });
  });

  it('reps-set variant: not ready when a set falls short of the top', () => {
    const logs = [repsLog(24, PUSH_ID, 12), repsLog(72, PUSH_ID, 15)];
    const r = readyToProgress({ exerciseId: PUSH_ID, logs, target: '8-15', youth: false, catalogLookup: lookup });
    expect(r.ready).toBe(false);
    expect(r.reason).toBe('sets-below-target');
  });

  it('no progression child means never ready, however good the sessions', () => {
    const logs = [repsLog(24, LEAF_ID, 100), repsLog(72, LEAF_ID, 100)];
    const r = readyToProgress({ exerciseId: LEAF_ID, logs, target: '8-15', youth: false, catalogLookup: lookup });
    expect(r).toEqual({ ready: false, reason: 'no-progression-child' });
  });

  it('youth is blocked from ring dip even with 2 qualifying sessions', () => {
    const logs = [repsLog(24, RING_PARENT, 12), repsLog(72, RING_PARENT, 12)];
    const r = readyToProgress({ exerciseId: RING_PARENT, logs, target: '6-12', youth: true, catalogLookup: lookup });
    expect(r.ready).toBe(false);
    expect(r.reason).toBe('youth-boundary');
    expect(r.nextExerciseId).toBe(RING_CHILD);
    expect(YOUTH_PROGRESSION_ALLOWLIST.has(RING_CHILD)).toBe(false);
  });

  it('a youth-allowed next step still progresses normally', () => {
    const logs = [timeLog(24, DIP_ID, 30), timeLog(72, DIP_ID, 30)];
    const r = readyToProgress({ exerciseId: DIP_ID, logs, target: '10-30s', youth: true, catalogLookup: lookup });
    expect(r).toEqual({ ready: true, nextExerciseId: DIP_CHILD, reason: 'ready' });
  });

  it('deleted and deload logs are skipped when picking the 2 most recent sessions', () => {
    const logs = [
      repsLog(12, PUSH_ID, 6, true, { isDeload: true }), // most recent, but a deload: skipped
      repsLog(24, PUSH_ID, 4, true, { deletedAt: '2026-09-01T00:00:00.000Z' }), // soft-deleted: skipped
      repsLog(36, PUSH_ID, 15), // real 1st most-recent eligible session
      repsLog(48, PUSH_ID, 15), // real 2nd most-recent eligible session
      repsLog(60, PUSH_ID, 2), // older still, never reached
    ];
    const r = readyToProgress({ exerciseId: PUSH_ID, logs, target: '8-15', youth: false, catalogLookup: lookup });
    expect(r).toEqual({ ready: true, nextExerciseId: PUSH_CHILD, reason: 'ready' });
  });
});

describe('isYouthProfile', () => {
  it('under 16 is youth', () => {
    expect(isYouthProfile(2015, new Date('2026-09-27'))).toBe(true); // age 11
  });

  it('16 or older is not youth', () => {
    expect(isYouthProfile(2010, new Date('2026-09-27'))).toBe(false); // age 16
  });

  it('no birth year is never youth', () => {
    expect(isYouthProfile(undefined, new Date('2026-09-27'))).toBe(false);
  });
});
