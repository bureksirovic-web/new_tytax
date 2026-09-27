import { describe, it, expect, beforeEach } from 'vitest';
import type { SessionExercise, SetEntry } from '@/contracts/domain';
import { useWorkoutStore } from '../workout-store';
import { useRestTimerStore } from '../rest-timer-store';
import { ex } from './g3-helpers';

const store = () => useWorkoutStore.getState();
const draft = () => {
  const d = store().draft;
  if (!d) throw new Error('expected a draft');
  return d;
};
const set = (id: string, over: Partial<SetEntry> = {}): SetEntry => ({ id, type: 'working', kg: 50, reps: 0, done: false, ...over });
const se = (uid: string, sets: SetEntry[], over: Partial<SessionExercise> = {}): SessionExercise => ({
  uid, exerciseId: uid, exerciseName: uid, modality: 'tytax', sets, ...over,
});
const row = ex('row', [['Lats', 90]], { name: 'Row', restSeconds: 75 });

describe('workout store — G3 actions', () => {
  beforeEach(() => {
    store().discard();
    localStorage.clear();
  });

  it('startDraft copies exercises, de-duplicates uids and keeps program fields', () => {
    const input = [se('a', [set('s1')]), se('a', [set('s2')])];
    const d = store().startDraft({ profileId: 'p1', sessionName: 'Upper', programId: 'prog', programSessionId: 's0', exercises: input, isDeload: true, notes: 'n' });
    expect(d.exercises.map((e) => e.uid)[0]).toBe('a');
    expect(d.exercises[1].uid).not.toBe('a');
    expect([d.programId, d.programSessionId, d.isDeload, d.notes]).toEqual(['prog', 's0', true, 'n']);
    expect(d.exercises[0]).not.toBe(input[0]);
    const quick = store().startDraft({ profileId: 'p1', sessionName: 'Q' });
    expect(quick.exercises).toEqual([]);
    expect('isDeload' in quick || 'programId' in quick).toBe(false);
  });

  it('swapExercise replaces an untrained exercise in place (same uid, fresh sets)', () => {
    store().startDraft({ profileId: 'p1', sessionName: 'S', exercises: [se('a', [set('w', { type: 'warmup' }), set('1'), set('2')], { supersetGroup: 'A', notes: 'x', restSeconds: 30 }), se('b', [set('3')])] });
    const before = draft();
    const uid = store().swapExercise('a', row);
    expect(uid).toBe('a');
    const after = draft().exercises[0];
    expect([after.exerciseId, after.exerciseName, after.restSeconds, after.supersetGroup, after.notes]).toEqual(['row', 'Row', 75, 'A', undefined]);
    // two working sets before → two fresh working sets
    expect(after.sets.map((s) => [s.type, s.kg, s.done])).toEqual([['working', 0, false], ['working', 0, false]]);
    expect(after.muscleImpactSnapshot).toEqual([{ muscle: 'Lats', score: 90 }]);
    expect(before.exercises[0].exerciseId).toBe('a'); // previous draft object untouched
    expect(draft().exercises[1].uid).toBe('b');
  });

  it('swapExercise uses given sets and drops a rest the new exercise lacks', () => {
    store().startDraft({ profileId: 'p1', sessionName: 'S', exercises: [se('a', [set('1')], { restSeconds: 30 })] });
    store().swapExercise('a', ex('fly', []), [set('n1', { kg: 12 }), set('n2', { kg: 12 })]);
    expect(draft().exercises[0].sets.map((s) => s.id)).toEqual(['n1', 'n2']);
    expect(draft().exercises[0].restSeconds).toBeUndefined();
  });

  it('swapExercise keeps a trained exercise and inserts the new one after it', () => {
    store().startDraft({ profileId: 'p1', sessionName: 'S', exercises: [se('a', [set('1', { done: true, reps: 8 }), set('2')], { supersetGroup: 'A' }), se('b', [set('3')])] });
    const uid = store().swapExercise('a', row);
    expect(uid).not.toBe('a');
    expect(draft().exercises.map((e) => e.exerciseId)).toEqual(['a', 'row', 'b']);
    expect(draft().exercises[1].uid).toBe(uid);
    expect(draft().exercises[1].supersetGroup).toBeUndefined();
    expect(draft().exercises[0].sets.map((s) => [s.id, s.done])).toEqual([['1', true]]);
    // Only the undone working set moves to the new exercise.
    expect(draft().exercises[1].sets.map((s) => [s.type, s.done])).toEqual([['working', false]]);
  });

  it('discard also stops a running rest timer', () => {
    store().startDraft({ profileId: 'p1', sessionName: 'S' });
    useRestTimerStore.getState().start(90);
    expect(useRestTimerStore.getState().timer).not.toBeNull();
    store().discard();
    expect(store().draft).toBeNull();
    expect(useRestTimerStore.getState().timer).toBeNull();
  });

  it('swapExercise returns null for an unknown uid or no draft', () => {
    expect(store().swapExercise('a', row)).toBeNull();
    store().startDraft({ profileId: 'p1', sessionName: 'S' });
    const d = draft();
    expect(store().swapExercise('zzz', row)).toBeNull();
    expect(draft()).toBe(d);
  });

  it('addPreparedExercise appends and re-issues a clashing uid', () => {
    expect(store().addPreparedExercise(se('a', []))).toBeNull();
    store().startDraft({ profileId: 'p1', sessionName: 'S', exercises: [se('a', [])] });
    expect(store().addPreparedExercise(se('b', [set('1')]))).toBe('b');
    const clash = store().addPreparedExercise(se('a', []));
    expect(clash).not.toBe('a');
    expect(draft().exercises.map((e) => e.uid)).toEqual(['a', 'b', clash]);
  });

  it('prependWarmups inserts before the first working set as undone warm-ups', () => {
    store().startDraft({ profileId: 'p1', sessionName: 'S', exercises: [se('a', [set('w0', { type: 'warmup' }), set('1'), set('2')]), se('b', [])] });
    store().prependWarmups('a', [set('w1', { done: true }), set('w2')]);
    expect(draft().exercises[0].sets.map((s) => [s.id, s.type, s.done])).toEqual([
      ['w0', 'warmup', false], ['w1', 'warmup', false], ['w2', 'warmup', false], ['1', 'working', false], ['2', 'working', false],
    ]);
    store().prependWarmups('b', [set('w3')]);
    expect(draft().exercises[1].sets.map((s) => s.id)).toEqual(['w3']);
    const d = draft();
    store().prependWarmups('b', []);
    expect(draft().exercises[1]).toBe(d.exercises[1]);
  });

  it('replaceExercises swaps the list and sets or clears isDeload', () => {
    store().replaceExercises([se('x', [])]);
    expect(store().draft).toBeNull();
    store().startDraft({ profileId: 'p1', sessionName: 'S', exercises: [se('a', [])] });
    store().replaceExercises([se('x', []), se('y', [])], { isDeload: true });
    expect(draft().exercises.map((e) => e.uid)).toEqual(['x', 'y']);
    expect(draft().isDeload).toBe(true);
    store().replaceExercises([se('z', [])]);
    expect(draft().isDeload).toBe(true);
    store().replaceExercises([se('z', [])], { isDeload: false });
    expect('isDeload' in draft()).toBe(false);
  });
});
