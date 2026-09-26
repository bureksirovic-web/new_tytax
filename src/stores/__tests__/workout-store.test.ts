import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { Exercise, Program, ProgramExercise, SetEntry } from '@/contracts/domain';
import {
  WORKOUT_DRAFT_STORAGE_KEY,
  WORKOUT_DRAFT_VERSION,
  isWorkoutDraft,
  useWorkoutStore,
} from '../workout-store';

function makeExercise(over: Partial<Exercise> = {}): Exercise {
  return {
    id: 'bench-press',
    name: 'Bench Press',
    modality: 'tytax',
    muscleGroup: 'CHEST',
    pattern: 'horizontal push',
    isUnilateral: false,
    defaultSets: 4,
    defaultReps: '8-12',
    impact: [{ muscle: 'Chest', score: 90 }],
    restSeconds: 120,
    ...over,
  };
}

function slot(exerciseId: string, sets: number, over: Partial<ProgramExercise> = {}): ProgramExercise {
  return { exerciseId, exerciseName: exerciseId.toUpperCase(), modality: 'tytax', sets, reps: '8-12', ...over };
}

function makeProgram(): Program {
  return {
    id: 'prog-1',
    profileId: 'p1',
    name: 'Upper/Lower',
    splitType: 'upper_lower',
    frequency: 3,
    periodizationType: 'none',
    sessionOrder: ['Upper A', 'Lower A', 'Rest'],
    sessions: [
      { id: 's-upper', programId: 'prog-1', name: 'Upper A', dayIndex: 0, exercises: [slot('bench', 3, { restSeconds: 90 }), slot('row', 2)] },
      { id: 's-lower', programId: 'prog-1', name: 'Lower A', dayIndex: 1, exercises: [slot('squat', 4)] },
      { id: 's-rest', programId: 'prog-1', name: 'Rest', dayIndex: 2, exercises: [], isRest: true },
    ],
    modalitiesUsed: ['tytax'],
    isPreset: false,
    currentSessionIndex: 0,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
  };
}

const store = () => useWorkoutStore.getState();
const draft = () => {
  const d = store().draft;
  if (!d) throw new Error('expected a draft');
  return d;
};

describe('workout store', () => {
  beforeEach(() => {
    localStorage.clear();
    useWorkoutStore.setState({ draft: null });
    localStorage.clear();
  });

  it('startQuick creates an empty draft for the profile', () => {
    const d = store().startQuick('p1', 'Quick Workout');
    expect(store().draft).toEqual(d);
    expect(d.profileId).toBe('p1');
    expect(d.sessionName).toBe('Quick Workout');
    expect(d.exercises).toEqual([]);
    expect(Number.isNaN(Date.parse(d.startedAt))).toBe(false);
    expect(d.programId).toBeUndefined();
  });

  it('adds the same exercise twice with distinct uids and independent sets', () => {
    store().startQuick('p1', 'Quick');
    const ex = makeExercise();
    const a = store().addExercise(ex);
    const b = store().addExercise(ex);
    expect(a).not.toBeNull();
    expect(a).not.toBe(b);

    const [first, second] = draft().exercises;
    expect(first.exerciseId).toBe('bench-press');
    expect(second.exerciseId).toBe('bench-press');
    // defaultSets 4 is capped at 3 → min(4, 3) = 3 sets each.
    expect(first.sets).toHaveLength(3);
    expect(second.sets).toHaveLength(3);
    const ids = new Set([...first.sets, ...second.sets].map((s) => s.id));
    // 3 + 3 = 6 sets, all with distinct ids.
    expect(ids.size).toBe(6);
    expect(first.sets.every((s) => s.type === 'working' && s.kg === 0 && s.reps === 0 && !s.done)).toBe(true);
    expect(first.muscleImpactSnapshot).toEqual([{ muscle: 'Chest', score: 90 }]);
    expect(first.restSeconds).toBe(120);

    store().updateSet(first.uid, first.sets[0].id, { kg: 60, reps: 8 });
    const [f2, s2] = draft().exercises;
    expect(f2.sets[0]).toMatchObject({ kg: 60, reps: 8 });
    expect(s2.sets[0]).toMatchObject({ kg: 0, reps: 0 });
  });

  it('uses the default set count rules for addExercise', () => {
    store().startQuick('p1', 'Quick');
    store().addExercise(makeExercise({ id: 'a', defaultSets: 1 }));
    store().addExercise(makeExercise({ id: 'b', defaultSets: 0 }));
    const [a, b] = draft().exercises;
    // defaultSets 1 → min(1, 3) = 1 set.
    expect(a.sets).toHaveLength(1);
    // defaultSets 0 falls back to 3 → min(3, 3) = 3 sets.
    expect(b.sets).toHaveLength(3);
  });

  it('addExercise without a draft is a no-op', () => {
    expect(store().addExercise(makeExercise())).toBeNull();
    expect(store().draft).toBeNull();
  });

  it('adds, updates, removes and toggles sets', () => {
    store().startQuick('p1', 'Quick');
    const uid = store().addExercise(makeExercise({ defaultSets: 1 }));
    if (!uid) throw new Error('no uid');
    const firstId = draft().exercises[0].sets[0].id;

    store().updateSet(uid, firstId, { kg: 62.5, reps: 10, rir: 2 });
    store().addSet(uid);
    let sets = draft().exercises[0].sets;
    expect(sets).toHaveLength(2);
    // addSet copies the last set's kg (62.5) and resets reps to 0.
    expect(sets[1]).toMatchObject({ kg: 62.5, reps: 0, done: false, type: 'working' });
    expect(sets[1].rir).toBeUndefined();
    expect(sets[1].id).not.toBe(firstId);

    store().updateSet(uid, sets[1].id, { reps: 7, id: 'hijack' } as Partial<SetEntry>);
    sets = draft().exercises[0].sets;
    expect(sets[1].reps).toBe(7);
    expect(sets[1].id).not.toBe('hijack');

    store().toggleSetDone(uid, firstId);
    sets = draft().exercises[0].sets;
    expect(sets[0].done).toBe(true);
    expect(typeof sets[0].completedAt).toBe('string');

    store().toggleSetDone(uid, firstId);
    sets = draft().exercises[0].sets;
    expect(sets[0].done).toBe(false);
    expect(sets[0].completedAt).toBeUndefined();

    store().removeSet(uid, firstId);
    sets = draft().exercises[0].sets;
    expect(sets).toHaveLength(1);
    expect(sets[0].reps).toBe(7);
  });

  it('addSet on an exercise without sets starts at 0 kg', () => {
    store().startQuick('p1', 'Quick');
    const uid = store().addExercise(makeExercise({ defaultSets: 1 }));
    if (!uid) throw new Error('no uid');
    store().removeSet(uid, draft().exercises[0].sets[0].id);
    store().addSet(uid);
    expect(draft().exercises[0].sets).toEqual([expect.objectContaining({ kg: 0, reps: 0 })]);
  });

  it('ignores unknown uids and set ids', () => {
    store().startQuick('p1', 'Quick');
    store().addExercise(makeExercise());
    const before = draft();
    store().updateSet('nope', 'nope', { kg: 1 });
    store().toggleSetDone(before.exercises[0].uid, 'nope');
    store().moveExercise('nope', 1);
    expect(draft()).toEqual(before);
  });

  it('reorders and removes exercises', () => {
    store().startQuick('p1', 'Quick');
    const a = store().addExercise(makeExercise({ id: 'a' }));
    const b = store().addExercise(makeExercise({ id: 'b' }));
    const c = store().addExercise(makeExercise({ id: 'c' }));
    if (!a || !b || !c) throw new Error('no uid');
    const order = () => draft().exercises.map((e) => e.exerciseId);

    store().moveExercise(c, -1);
    expect(order()).toEqual(['a', 'c', 'b']);
    store().moveExercise(a, 1);
    expect(order()).toEqual(['c', 'a', 'b']);
    // Out of bounds: first cannot move up, last cannot move down.
    store().moveExercise(c, -1);
    store().moveExercise(b, 1);
    expect(order()).toEqual(['c', 'a', 'b']);

    store().removeExercise(a);
    expect(order()).toEqual(['c', 'b']);
  });

  it('sets notes and discards', () => {
    store().startQuick('p1', 'Quick');
    store().setNotes('felt strong');
    expect(draft().notes).toBe('felt strong');
    store().discard();
    expect(store().draft).toBeNull();
    store().setNotes('ignored');
    expect(store().draft).toBeNull();
  });

  it('startFromProgram builds empty working sets from the slots', () => {
    const d = store().startFromProgram('p1', makeProgram(), 0);
    expect(d).not.toBeNull();
    expect(draft()).toEqual(d);
    expect(draft()).toMatchObject({ profileId: 'p1', programId: 'prog-1', programSessionId: 's-upper', sessionName: 'Upper A' });
    const [bench, row] = draft().exercises;
    expect(bench).toMatchObject({ exerciseId: 'bench', exerciseName: 'BENCH', modality: 'tytax', restSeconds: 90 });
    // Slot sets: bench 3, row 2.
    expect(bench.sets).toHaveLength(3);
    expect(row.sets).toHaveLength(2);
    expect(bench.sets.every((s) => s.kg === 0 && s.reps === 0 && s.type === 'working' && !s.done)).toBe(true);
  });

  it('startFromProgram wraps the index and refuses rest sessions', () => {
    // Index 4 in a 3-session rotation → 4 mod 3 = 1 → "Lower A".
    expect(store().startFromProgram('p1', makeProgram(), 4)?.sessionName).toBe('Lower A');
    // Index 2 is the rest session: no draft change.
    const before = store().draft;
    expect(store().startFromProgram('p1', makeProgram(), 2)).toBeNull();
    expect(store().draft).toBe(before);
    expect(store().startFromProgram('p1', { ...makeProgram(), sessions: [] }, 0)).toBeNull();
  });

  it('startFromProgram uses the prefill result when given', () => {
    const prefill = vi.fn((exerciseId: string, s: ProgramExercise): SetEntry[] =>
      exerciseId === 'bench'
        ? Array.from({ length: s.sets }, (_, i) => ({
            id: 'same-id',
            type: 'working' as const,
            kg: 80,
            reps: 0,
            done: true,
            ghostKg: 77.5,
            ghostReps: 8 + i,
          }))
        : [],
    );
    store().startFromProgram('p1', makeProgram(), 0, { prefill });
    expect(prefill).toHaveBeenCalledTimes(2);
    expect(prefill).toHaveBeenCalledWith('bench', expect.objectContaining({ exerciseId: 'bench', sets: 3 }));

    const [bench, row] = draft().exercises;
    // Prefill produced slot.sets = 3 sets for bench.
    expect(bench.sets).toHaveLength(3);
    expect(bench.sets.map((s) => s.ghostReps)).toEqual([8, 9, 10]);
    expect(bench.sets.every((s) => s.kg === 80 && s.ghostKg === 77.5 && !s.done)).toBe(true);
    // Every set gets its own fresh id even when the prefill repeats one.
    expect(new Set(bench.sets.map((s) => s.id)).size).toBe(3);
    // An empty prefill falls back to slot.sets = 2 empty working sets.
    expect(row.sets).toHaveLength(2);
    expect(row.sets[0]).toMatchObject({ kg: 0, reps: 0 });
  });

  it('persists the draft to localStorage and restores it on rehydrate', async () => {
    store().startQuick('p1', 'Quick');
    const uid = store().addExercise(makeExercise());
    if (!uid) throw new Error('no uid');
    store().updateSet(uid, draft().exercises[0].sets[0].id, { kg: 100, reps: 5 });
    const saved = draft();

    const raw = localStorage.getItem(WORKOUT_DRAFT_STORAGE_KEY);
    expect(raw).not.toBeNull();
    const parsed: unknown = JSON.parse(raw ?? 'null');
    expect(parsed).toMatchObject({ version: WORKOUT_DRAFT_VERSION, state: { draft: { id: saved.id } } });

    // Simulate a reload: memory is wiped, storage keeps the last write.
    useWorkoutStore.setState({ draft: null });
    localStorage.setItem(WORKOUT_DRAFT_STORAGE_KEY, raw ?? '');
    await useWorkoutStore.persist.rehydrate();

    expect(useWorkoutStore.persist.hasHydrated()).toBe(true);
    expect(store().draft).toEqual(saved);
    expect(draft().exercises[0].sets[0]).toMatchObject({ kg: 100, reps: 5 });
  });

  it('drops a corrupt or old-version persisted draft', async () => {
    store().startQuick('p1', 'Quick');
    localStorage.setItem(WORKOUT_DRAFT_STORAGE_KEY, JSON.stringify({ version: 3, state: { draft: { id: 1 } } }));
    await useWorkoutStore.persist.rehydrate();
    expect(store().draft).toBeNull();

    store().startQuick('p1', 'Quick');
    const valid = draft();
    localStorage.setItem(WORKOUT_DRAFT_STORAGE_KEY, JSON.stringify({ version: 2, state: { draft: valid } }));
    await useWorkoutStore.persist.rehydrate();
    // A valid draft under an older version survives migration unchanged.
    expect(store().draft).toEqual(valid);

    localStorage.setItem(WORKOUT_DRAFT_STORAGE_KEY, JSON.stringify({ version: 2, state: { sets: {} } }));
    await useWorkoutStore.persist.rehydrate();
    expect(store().draft).toBeNull();
  });

  it('isWorkoutDraft rejects malformed shapes', () => {
    expect(isWorkoutDraft(null)).toBe(false);
    expect(isWorkoutDraft([])).toBe(false);
    expect(
      isWorkoutDraft({ id: 'd', profileId: 'p', sessionName: 's', startedAt: 't', exercises: [{ uid: 'u' }] }),
    ).toBe(false);
    expect(isWorkoutDraft({ id: 'd', profileId: 'p', sessionName: 's', startedAt: 't', exercises: [] })).toBe(true);
  });

  it('useWorkoutHydrated rehydrates once on mount and then reports true', async () => {
    store().startQuick('p1', 'Persisted');
    const raw = localStorage.getItem(WORKOUT_DRAFT_STORAGE_KEY) ?? '';

    // A fresh module instance is a fresh page load: nothing hydrated yet.
    vi.resetModules();
    const fresh = await import('../workout-store');
    expect(fresh.useWorkoutStore.persist.hasHydrated()).toBe(false);
    expect(fresh.useWorkoutStore.getState().draft).toBeNull();
    localStorage.setItem(WORKOUT_DRAFT_STORAGE_KEY, raw);

    const rehydrate = vi.spyOn(fresh.useWorkoutStore.persist, 'rehydrate');
    const seen: boolean[] = [];
    const { result, rerender } = renderHook(() => {
      const hydrated = fresh.useWorkoutHydrated();
      seen.push(hydrated);
      return hydrated;
    });
    await act(async () => {});
    rerender();

    expect(seen[0]).toBe(false);
    expect(result.current).toBe(true);
    expect(rehydrate).toHaveBeenCalledTimes(1);
    expect(fresh.useWorkoutStore.getState().draft?.sessionName).toBe('Persisted');
  });
});
