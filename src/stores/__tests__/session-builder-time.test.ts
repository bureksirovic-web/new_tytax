import { describe, it, expect } from 'vitest';
import type { WorkoutLog } from '@/contracts/domain';
import { applyDeload, buildSessionExercise } from '../session-builder';
import { ex, log, settings } from './g3-helpers';

// G1 tags time exercises in the catalog (`measure: 'time'`); the defaultReps heuristic that used to
// infer it is gone, so the fixture carries the tag like the real catalog entry.
const plank = ex('plank', [['Abs', 90]], { name: 'Plank', modality: 'tytax', measure: 'time', defaultReps: '30-60s', defaultSets: 3 });
const tagged = ex('hold', [['Abs', 90]], { measure: 'time', defaultReps: '8-12', defaultSets: 2 });

/** A log of `exerciseId` whose sets carry the given durations (null = not done). */
function timedLog(daysAgo: number, exerciseId: string, durations: Array<number | null>, warmup = false): WorkoutLog {
  const l = log(daysAgo, [{ exerciseId, sets: [...(warmup ? [{ kg: 0, reps: 0, type: 'warmup' as const }] : []), ...durations.map((d) => ({ kg: 0, reps: 0, done: d !== null }))] }]);
  const working = l.exercises[0].sets.filter((s) => s.type !== 'warmup');
  durations.forEach((d, i) => {
    if (d !== null) working[i].durationSeconds = d;
  });
  if (warmup) l.exercises[0].sets[0].durationSeconds = 999;
  return l;
}

describe('buildSessionExercise — time exercises', () => {
  it('without history: no warm-ups, kg/reps 0, no duration, min(defaultSets, 3) sets', () => {
    const out = buildSessionExercise({ exercise: plank, history: [], settings: settings() });
    expect(out.sets).toHaveLength(3);
    for (const s of out.sets) {
      // No history: no durationSeconds and no ghostDurationSeconds.
      expect(s).toEqual({ id: s.id, type: 'working', kg: 0, reps: 0, done: false });
    }
  });

  it('prefills each working index from the newest log, holds (no progression) and never warms up', () => {
    const older = timedLog(7, 'plank', [20, 20, 20]);
    // Newest: 40 s, 50 s, the third set not done → index 2 has no prefill.
    const newest = timedLog(2, 'plank', [40, 50, null], true);
    const out = buildSessionExercise({ exercise: plank, history: [newest, older], settings: settings() });
    // Refuter-2 F1: nothing is prefilled as a value; the input starts empty.
    expect(out.sets.map((s) => [s.type, s.kg, s.reps, s.durationSeconds])).toEqual([
      ['working', 0, 0, undefined],
      ['working', 0, 0, undefined],
      ['working', 0, 0, undefined],
    ]);
    // ghostDurationSeconds (contract hint): last session's seconds at the same index; the undone set has none.
    expect(out.sets.map((s) => s.ghostDurationSeconds)).toEqual([40, 50, undefined]);
    expect(out.sets.some((s) => s.ghostKg !== undefined || s.ghostReps !== undefined)).toBe(false);
  });

  it('targetSets past the last session get no hint and no value; fewer sets cut from the end', () => {
    const newest = timedLog(1, 'hold', [30, 35]);
    const more = buildSessionExercise({ exercise: tagged, history: [newest], settings: settings(), targetSets: 4 });
    expect(more.sets.map((s) => s.durationSeconds)).toEqual([undefined, undefined, undefined, undefined]);
    // Like ghostKg, the hint exists only for indices last session had.
    expect(more.sets.map((s) => s.ghostDurationSeconds)).toEqual([30, 35, undefined, undefined]);
    const fewer = buildSessionExercise({ exercise: tagged, history: [newest], settings: settings(), targetSets: 1 });
    expect(fewer.sets.map((s) => [s.durationSeconds, s.ghostDurationSeconds])).toEqual([[undefined, 30]]);
  });

  it('ignores deleted logs and uses the history set count when no target is given', () => {
    const deleted = { ...timedLog(0, 'hold', [99, 99, 99, 99]), deletedAt: '2026-09-20T00:00:00.000Z' };
    const kept = timedLog(3, 'hold', [25, 25, 25]);
    const out = buildSessionExercise({ exercise: tagged, history: [deleted, kept], settings: settings() });
    expect(out.sets.map((s) => s.ghostDurationSeconds)).toEqual([25, 25, 25]);
    expect(out.sets.every((s) => s.durationSeconds === undefined)).toBe(true);
  });

  it('input.measure overrides the catalog; a reps exercise is unchanged', () => {
    const asTime = buildSessionExercise({ slot: { exerciseId: 'x', exerciseName: 'X', modality: 'tytax', sets: 2, reps: '8' }, history: [], settings: settings(), measure: 'time' });
    expect(asTime.sets.map((s) => [s.kg, s.reps, s.durationSeconds])).toEqual([[0, 0, undefined], [0, 0, undefined]]);
    const asReps = buildSessionExercise({ exercise: plank, history: [], settings: settings(), measure: 'reps', targetSets: 1 });
    expect(asReps.sets).toHaveLength(1);
    expect('durationSeconds' in asReps.sets[0]).toBe(false);
  });

  it('a deload keeps the held-duration hints and drops one set', () => {
    const built = buildSessionExercise({ exercise: tagged, history: [timedLog(1, 'hold', [30, 40, 50])], settings: settings() });
    const [deloaded] = applyDeload([built], settings());
    expect(deloaded.sets.map((s) => [s.kg, s.durationSeconds, s.ghostDurationSeconds])).toEqual([[0, undefined, 30], [0, undefined, 40]]);
  });
});
