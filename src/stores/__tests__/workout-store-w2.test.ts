import { describe, it, expect, beforeEach } from 'vitest';
import type { SessionExercise, SetEntry, WorkoutLog } from '@/contracts/domain';
import { useWorkoutStore, isWorkoutDraft } from '../workout-store';
import { useRestTimerStore } from '../rest-timer-store';
import { countsAsWork, countsAsWorkFor, countsForVolume, exerciseVolumeKg, summarizeDraft } from '../workout-selectors';

const store = () => useWorkoutStore.getState();
const draft = () => {
  const d = store().draft;
  if (!d) throw new Error('expected a draft');
  return d;
};
const set = (id: string, over: Partial<SetEntry> = {}): SetEntry => ({ id, type: 'working', kg: 0, reps: 0, done: false, ...over });
const se = (uid: string, sets: SetEntry[], over: Partial<SessionExercise> = {}): SessionExercise => ({
  uid, exerciseId: uid, exerciseName: uid, modality: 'tytax', sets, ...over,
});
const setOf = (uid: string, id: string) => {
  const s = draft().exercises.find((e) => e.uid === uid)?.sets.find((x) => x.id === id);
  if (!s) throw new Error('expected a set');
  return s;
};

describe('workout store — Wave 2 time sets', () => {
  beforeEach(() => {
    store().discard();
    localStorage.clear();
  });

  it('updateSet stores whole non-negative seconds', () => {
    store().startDraft({ profileId: 'p1', sessionName: 'S', exercises: [se('plank', [set('t1', { durationSeconds: 0 })])] });
    store().updateSet('plank', 't1', { durationSeconds: 45.8 });
    expect(setOf('plank', 't1').durationSeconds).toBe(45);
    store().updateSet('plank', 't1', { durationSeconds: -3 });
    expect(setOf('plank', 't1').durationSeconds).toBe(0);
    store().updateSet('plank', 't1', { durationSeconds: Number.NaN });
    expect(setOf('plank', 't1').durationSeconds).toBe(0);
  });

  it('toggleTimeSetDone needs seconds > 0, ignores reps/kg, and undoes', () => {
    store().startDraft({ profileId: 'p1', sessionName: 'S', exercises: [se('plank', [set('t1'), set('t2', { durationSeconds: 30 })])] });
    store().toggleTimeSetDone('plank', 't1');
    expect(setOf('plank', 't1').done).toBe(false);
    store().toggleTimeSetDone('plank', 't2');
    expect(setOf('plank', 't2')).toMatchObject({ done: true, reps: 0, kg: 0, durationSeconds: 30 });
    expect(typeof setOf('plank', 't2').completedAt).toBe('string');
    store().toggleTimeSetDone('plank', 't2');
    expect(setOf('plank', 't2').done).toBe(false);
    expect(setOf('plank', 't2').completedAt).toBeUndefined();
    // Unknown ids are no-ops.
    const before = draft();
    store().toggleTimeSetDone('nope', 't2');
    store().toggleTimeSetDone('plank', 'nope');
    expect(draft()).toEqual(before);
  });

  it('a done time set stays done on edits with seconds and is undone at 0 s', () => {
    store().startDraft({ profileId: 'p1', sessionName: 'S', exercises: [se('plank', [set('t1', { durationSeconds: 30 })])] });
    store().toggleTimeSetDone('plank', 't1');
    store().updateSet('plank', 't1', { durationSeconds: 40 });
    expect(setOf('plank', 't1')).toMatchObject({ done: true, durationSeconds: 40 });
    store().updateSet('plank', 't1', { durationSeconds: 0 });
    expect(setOf('plank', 't1').done).toBe(false);
  });

  it('an explicit measure decides the done rule on edits', () => {
    store().startDraft({ profileId: 'p1', sessionName: 'S', exercises: [se('plank', [set('t1', { durationSeconds: 30, done: true })]), se('bench', [set('b1', { kg: 100, reps: 5, done: true, durationSeconds: 0 })])] });
    // measure 'time': a reps edit on a set without seconds field still uses seconds.
    store().updateSet('plank', 't1', { rir: 2 }, 'time');
    expect(setOf('plank', 't1').done).toBe(true);
    // measure 'reps': the stray durationSeconds 0 is ignored; 100 kg × 5 stays done.
    store().updateSet('bench', 'b1', { rir: 1 }, 'reps');
    expect(setOf('bench', 'b1').done).toBe(true);
    store().updateSet('bench', 'b1', { reps: 0 }, 'reps');
    expect(setOf('bench', 'b1').done).toBe(false);
  });

  it('addSet copies the last set’s durationSeconds (and not for rep sets)', () => {
    store().startDraft({ profileId: 'p1', sessionName: 'S', exercises: [se('plank', [set('t1', { durationSeconds: 50 })]), se('bench', [set('b1', { kg: 80 })])] });
    store().addSet('plank');
    store().addSet('bench');
    const plank = draft().exercises[0].sets;
    expect(plank).toHaveLength(2);
    expect(plank[1]).toMatchObject({ type: 'working', kg: 0, reps: 0, done: false, durationSeconds: 50 });
    expect('durationSeconds' in draft().exercises[1].sets[1]).toBe(false);
  });

  it('persisted drafts with a non-number durationSeconds are rejected', () => {
    // startedAt must parse since hardening F4 ('x' was accepted before).
    const good = { id: 'd', profileId: 'p', sessionName: 'S', startedAt: '2026-09-20T10:00:00.000Z', exercises: [se('a', [set('1', { durationSeconds: 30 })])] };
    expect(isWorkoutDraft(good)).toBe(true);
    const bad = { ...good, exercises: [se('a', [{ ...set('1'), durationSeconds: '30' as unknown as number }])] };
    expect(isWorkoutDraft(bad)).toBe(false);
  });
});

describe('workout selectors — Wave 2 time sets', () => {
  it('count done time sets with seconds and exclude them from kg volume', () => {
    const exercises = [
      // 100 kg × 5 + 100 kg × 5 = 1000 kg; the warm-up and the undone set do not count.
      se('bench', [set('w', { type: 'warmup', kg: 40, reps: 8, done: true }), set('1', { kg: 100, reps: 5, done: true }), set('2', { kg: 100, reps: 5, done: true }), set('3', { kg: 100, reps: 5 })]),
      // Time sets: 30 s + 45 s done (75 s); a done 0 s set and an undone 60 s set do not count; kg 20 is never volume.
      se('plank', [set('t1', { durationSeconds: 30, done: true, kg: 20 }), set('t2', { durationSeconds: 45, done: true }), set('t3', { durationSeconds: 0, done: true }), set('t4', { durationSeconds: 60 })]),
    ];
    const d = { id: 'd', profileId: 'p', sessionName: 'S', startedAt: 'x', exercises };
    expect(summarizeDraft(d)).toEqual({ exerciseCount: 2, doneSets: 4, totalSets: 8, volumeKg: 1000, timeSeconds: 75 });
    expect(exerciseVolumeKg(exercises[1])).toBe(0);
  });

  it('a measureOf lookup decides per exercise', () => {
    // 'hold' is a time exercise whose sets carry no seconds yet: a done set with reps 10 is not work.
    const exercises = [se('hold', [set('1', { reps: 10, kg: 5, done: true })]), se('row', [set('2', { kg: 50, reps: 10, done: true, durationSeconds: 0 })])];
    const d = { id: 'd', profileId: 'p', sessionName: 'S', startedAt: 'x', exercises };
    const measureOf = (id: string) => (id === 'hold' ? ('time' as const) : ('reps' as const));
    // row: 50 × 10 = 500 kg (its stray durationSeconds is ignored with the lookup).
    expect(summarizeDraft(d, { measureOf })).toEqual({ exerciseCount: 2, doneSets: 1, totalSets: 2, volumeKg: 500, timeSeconds: 0 });
    expect(countsAsWorkFor(exercises[0].sets[0], 'reps')).toBe(true);
    expect(countsForVolume(exercises[0].sets[0], 'time')).toBe(false);
    expect([exercises[1].sets[0]].filter(countsAsWork)).toHaveLength(0);
  });
});

describe('workout store — startFromLog and reorderExercises', () => {
  beforeEach(() => {
    store().discard();
    localStorage.clear();
  });

  const log: WorkoutLog = {
    id: 'log1', profileId: 'p1', programId: 'prog', programSessionId: 'push', sessionName: 'Push A', date: '2026-09-20',
    startedAt: '2026-09-20T10:00:00.000Z', finishedAt: '2026-09-20T11:00:00.000Z', durationSeconds: 3600,
    exercises: [
      se('u1', [
        set('w', { type: 'warmup', kg: 40, reps: 8, done: true, completedAt: 'c' }),
        set('a', { kg: 100, reps: 5, rir: 2, done: true, completedAt: 'c', isPR: true, e1rm: 116.7, tempo: '3-1-1-0', ghostKg: 95, ghostReps: 5 }),
        set('b', { kg: 100, reps: 3, done: false }),
      ], { exerciseId: 'bench', exerciseName: 'Bench', restSeconds: 120, supersetGroup: 'A', notes: 'felt heavy', muscleImpactSnapshot: [{ muscle: 'Chest', score: 100 }] }),
      se('u2', [set('t', { durationSeconds: 45, done: true })], { exerciseId: 'plank', exerciseName: 'Plank', modality: 'bodyweight' }),
    ],
    notes: 'good day', rpe: 8, totalVolumeKg: 500, totalSets: 2, prCount: 1, modalitiesUsed: ['tytax', 'bodyweight'], isDeload: true,
    createdAt: 'c', updatedAt: 'c',
  };

  it('starts a quick draft that repeats the log, reset and prefilled', () => {
    useRestTimerStore.getState().start(90);
    expect(useRestTimerStore.getState().timer).not.toBeNull();
    const d = store().startFromLog('p1', log);
    expect(store().draft).toBe(d);
    expect(useRestTimerStore.getState().timer).toBeNull();
    expect(d.id).not.toBe('log1');
    expect(d.sessionName).toBe('Push A');
    expect(d.profileId).toBe('p1');
    for (const key of ['programId', 'programSessionId', 'isDeload', 'notes'] as const) expect(key in d, key).toBe(false);
    expect(d.exercises.map((e) => e.exerciseId)).toEqual(['bench', 'plank']);
    expect(d.exercises.map((e) => e.uid)).not.toContain('u1');
    const [bench, plank] = d.exercises;
    expect(bench).toMatchObject({ exerciseName: 'Bench', modality: 'tytax', restSeconds: 120, supersetGroup: 'A', muscleImpactSnapshot: [{ muscle: 'Chest', score: 100 }] });
    expect('notes' in bench).toBe(false);
    expect(bench.sets[0]).toEqual({ id: bench.sets[0].id, type: 'warmup', kg: 40, reps: 8, done: false });
    expect(bench.sets[1]).toEqual({ id: bench.sets[1].id, type: 'working', kg: 100, reps: 5, done: false, tempo: '3-1-1-0', ghostKg: 100, ghostReps: 5 });
    expect(bench.sets[2]).toEqual({ id: bench.sets[2].id, type: 'working', kg: 100, reps: 3, done: false });
    expect(new Set(bench.sets.map((s) => s.id)).has('a')).toBe(false);
    expect(plank.sets[0]).toEqual({ id: plank.sets[0].id, type: 'working', kg: 0, reps: 0, done: false, durationSeconds: 45 });
    // The log is untouched.
    expect(log.exercises[0].sets[1].done).toBe(true);
    expect(log.exercises[0].muscleImpactSnapshot).toEqual([{ muscle: 'Chest', score: 100 }]);
  });

  it('reorderExercises applies an exact permutation and ignores anything else', () => {
    store().startDraft({ profileId: 'p1', sessionName: 'S', exercises: [se('a', []), se('b', []), se('c', [])] });
    const order = () => draft().exercises.map((e) => e.uid);
    const before = draft();
    for (const bad of [['a', 'b'], ['a', 'b', 'c', 'd'], ['a', 'a', 'b'], ['a', 'b', 'x'], [], ['a', 'b', 'c']]) {
      store().reorderExercises(bad);
      expect(draft(), bad.join()).toBe(before);
    }
    store().reorderExercises(['c', 'a', 'b']);
    expect(order()).toEqual(['c', 'a', 'b']);
    expect(draft().exercises[1]).toBe(before.exercises[0]);
    store().discard();
    store().reorderExercises(['a']);
    expect(store().draft).toBeNull();
  });
});
