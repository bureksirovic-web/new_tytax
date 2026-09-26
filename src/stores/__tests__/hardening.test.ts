/**
 * Hardening pass (refuter findings F1–F10 on the Wave 1 stores). Each block
 * first reproduced the finding on the unfixed code; the expectations are the
 * fixed behaviour.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { EquipmentInventory, SessionExercise, SetEntry, WorkoutDraft } from '@/contracts/domain';
import { swapAvailability } from '@/components/workout/picker-filter';
import { swapInDraft } from '../draft-ops';
import { applyDeload, buildSessionExercise, isAvailable, weakPoint } from '../session-builder';
import { REST_TIMER_STORAGE_KEY, restProgress, restRemaining, useRestTimerStore } from '../rest-timer-store';
import { WORKOUT_DRAFT_STORAGE_KEY, isWorkoutDraft, useWorkoutStore } from '../workout-store';
import { NOW, ex, log, lookupOf, settings } from './g3-helpers';

const set = (id: string, over: Partial<SetEntry> = {}): SetEntry => ({ id, type: 'working', kg: 0, reps: 0, done: false, ...over });
const se = (uid: string, sets: SetEntry[], over: Partial<SessionExercise> = {}): SessionExercise => ({
  uid, exerciseId: uid, exerciseName: uid, modality: 'tytax', sets, ...over,
});
const draftOf = (exercises: SessionExercise[], over: Partial<WorkoutDraft> = {}): WorkoutDraft => ({
  id: 'd1', profileId: 'p1', sessionName: 'S', startedAt: '2026-09-20T10:00:00.000Z', exercises, ...over,
});
const inv = (over: Partial<EquipmentInventory> = {}): EquipmentInventory => ({
  id: 'p1', profileId: 'p1', stationIds: [], attachmentIds: [], kettlebellsKg: [], bodyweightGear: [], createdAt: '', updatedAt: '', ...over,
});
const persisted = (draft: unknown) => JSON.stringify({ version: 3, state: { draft } });

describe('F1 two tabs share one persisted draft', () => {
  beforeEach(() => localStorage.clear());

  it('a stale tab re-reads the draft on a storage event before it writes', async () => {
    vi.resetModules();
    const tabA = (await import('../workout-store')).useWorkoutStore;
    vi.resetModules();
    const tabB = (await import('../workout-store')).useWorkoutStore;
    const d = tabA.getState().startQuick('p1', 'Two tabs');
    const uid = tabA.getState().addExercise(ex('bench', [['Chest', 90]])) as string;
    await tabB.persist.rehydrate();
    const setId = tabA.getState().draft!.exercises[0].sets[0].id;
    tabA.getState().updateSet(uid, setId, { kg: 100, reps: 5 });
    tabA.getState().toggleSetDone(uid, setId);
    // The browser fires `storage` in every OTHER tab after A's write.
    window.dispatchEvent(new StorageEvent('storage', { key: WORKOUT_DRAFT_STORAGE_KEY }));
    tabB.getState().addSet(uid);
    const stored = JSON.parse(localStorage.getItem(WORKOUT_DRAFT_STORAGE_KEY) ?? 'null');
    expect(stored.state.draft.id).toBe(d.id);
    expect(stored.state.draft.exercises[0].sets[0]).toMatchObject({ kg: 100, reps: 5, done: true });
    expect(stored.state.draft.exercises[0].sets).toHaveLength(4);
  });

  it('a discard in another tab reaches this tab; unrelated keys are ignored; visible re-reads too', async () => {
    useWorkoutStore.getState().startQuick('p1', 'Mine');
    const mine = useWorkoutStore.getState().draft;
    window.dispatchEvent(new StorageEvent('storage', { key: 'something-else' }));
    expect(useWorkoutStore.getState().draft).toEqual(mine);
    localStorage.setItem(WORKOUT_DRAFT_STORAGE_KEY, persisted(null));
    window.dispatchEvent(new StorageEvent('storage', { key: WORKOUT_DRAFT_STORAGE_KEY }));
    expect(useWorkoutStore.getState().draft).toBeNull();
    // Returning to a background tab re-reads storage as well.
    const other = draftOf([], { id: 'other-tab' });
    localStorage.setItem(WORKOUT_DRAFT_STORAGE_KEY, persisted(other));
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(useWorkoutStore.getState().draft?.id).toBe('other-tab');
  });

  it('the rest timer follows another tab too', () => {
    useRestTimerStore.getState().start(90, 1_000);
    localStorage.setItem(REST_TIMER_STORAGE_KEY, JSON.stringify({ version: 1, state: { timer: null } }));
    window.dispatchEvent(new StorageEvent('storage', { key: REST_TIMER_STORAGE_KEY }));
    expect(useRestTimerStore.getState().timer).toBeNull();
  });
});

describe('F2 stations: unknown station is available, ids match across formats', () => {
  const byName = ex('smith-press', [], { station: 'Smith Machine' }); // this branch's catalog: display names only
  const byWave0 = ex('pulldown', [], { stationId: 'back-upper' });
  const byKey = ex('row', [], { stationId: 'BACK_LOWER' });
  const noStation = ex('mystery', []);
  const multi = ex('generic', [], { station: 'Tytax' });

  it('isAvailable (weak point)', () => {
    const wave0 = inv({ stationIds: ['smith', 'back-upper', 'back-lower', 'leg-extension', 'leg-curl', 'tytax'] });
    expect([byName, byWave0, byKey, noStation, multi].map((e) => isAvailable(e, wave0))).toEqual([true, true, true, true, true]);
    const g1Keys = inv({ stationIds: ['SMITH'] });
    expect([byName, byWave0, byKey, noStation, multi].map((e) => isAvailable(e, g1Keys))).toEqual([true, false, false, true, false]);
  });

  it('swapAvailability (swap sheet)', () => {
    const ok = swapAvailability(inv({ stationIds: ['smith', 'back-upper'] }));
    expect([byName, byWave0, byKey, noStation, multi].map(ok)).toEqual([true, true, false, true, false]);
  });
});

describe('F3 a done warm-up is not logged work in a swap', () => {
  it('replaces in place and carries the working plan', () => {
    const old = se('press', [set('wu1', { type: 'warmup', kg: 20, reps: 10, done: true }), set('n1', { kg: 62.5 }), set('n2', { kg: 72.5 })]);
    const res = swapInDraft(draftOf([old]), 'press', ex('fly', []));
    expect(res.inserted).toBe(false);
    expect(res.uid).toBe('press');
    expect(res.draft?.exercises.map((e) => e.exerciseId)).toEqual(['fly']);
    expect(res.draft?.exercises[0].sets).toHaveLength(2); // the two working sets still to do
  });
});

describe('F4 persisted draft validation', () => {
  beforeEach(() => localStorage.clear());
  const good = (id: string, over: Partial<SetEntry> = {}) => set(id, { kg: 100, reps: 5, done: true, ...over });

  it('isWorkoutDraft rejects out-of-range and unknown values', () => {
    const ok = draftOf([se('a', [good('s1')])]);
    expect(isWorkoutDraft(ok)).toBe(true);
    const bad: Array<[string, WorkoutDraft]> = [
      ['negative kg', draftOf([se('a', [good('s1', { kg: -50 })])])],
      ['reps 1e9', draftOf([se('a', [good('s1', { reps: 1e9 })])])],
      ['reps 1001', draftOf([se('a', [good('s1', { reps: 1001 })])])],
      ['non-integer reps', draftOf([se('a', [good('s1', { reps: 2.5 })])])],
      ['infinite kg', draftOf([se('a', [good('s1', { kg: Infinity })])])],
      ['rir 99', draftOf([se('a', [good('s1', { rir: 99 })])])],
      ['rir -1', draftOf([se('a', [good('s1', { rir: -1 })])])],
      ['set type', draftOf([se('a', [good('s1', { type: 'whatever' as SetEntry['type'] })])])],
      ['modality', draftOf([se('a', [good('s1')], { modality: 'banana' as SessionExercise['modality'] })])],
      ['duplicate uid', draftOf([se('same', [good('s1')]), se('same', [good('s2')])])],
      ['duplicate set id', draftOf([se('a', [good('s1'), good('s1')])])],
      ['startedAt', draftOf([], { startedAt: 'not-a-date' })],
      ['negative seconds', draftOf([se('a', [good('s1', { durationSeconds: -3 })])])],
    ];
    for (const [label, d] of bad) expect([label, isWorkoutDraft(d)]).toEqual([label, false]);
  });

  it('one bad set is dropped, the rest of the workout survives rehydrate', async () => {
    const d = draftOf([
      se('a', [good('s1'), good('s2', { kg: -50 }), good('s3', { reps: 1e9 }), good('s4', { rir: 7 })]),
      se('a', [good('t1')]),
      se('b', [good('u1'), good('u1', { kg: 80 })]),
      se('c', [good('v1')], { modality: 'banana' as SessionExercise['modality'] }),
    ]);
    localStorage.setItem(WORKOUT_DRAFT_STORAGE_KEY, persisted(d));
    await useWorkoutStore.persist.rehydrate();
    const got = useWorkoutStore.getState().draft;
    expect(got).not.toBeNull();
    expect(isWorkoutDraft(got)).toBe(true);
    // a: the negative-kg and 1e9-rep sets are dropped; rir 7 is clamped to 5.
    expect(got!.exercises[0].sets.map((s) => [s.id, s.kg, s.reps, s.rir])).toEqual([['s1', 100, 5, undefined], ['s4', 100, 5, 5]]);
    // The duplicate uid 'a' gets a fresh uid; the duplicate set id a fresh id; the banana exercise is dropped.
    expect(got!.exercises).toHaveLength(3);
    expect(new Set(got!.exercises.map((e) => e.uid)).size).toBe(3);
    expect(got!.exercises[0].uid).toBe('a');
    expect(got!.exercises[2].sets.map((s) => s.kg)).toEqual([100, 80]);
    expect(new Set(got!.exercises[2].sets.map((s) => s.id)).size).toBe(2);
  });

  it('a draft whose identity is broken is still dropped; a bad startedAt is repaired', async () => {
    localStorage.setItem(WORKOUT_DRAFT_STORAGE_KEY, persisted({ ...draftOf([]), profileId: 7 }));
    await useWorkoutStore.persist.rehydrate();
    expect(useWorkoutStore.getState().draft).toBeNull();
    const done = good('s1', { completedAt: '2026-09-20T10:05:00.000Z' });
    localStorage.setItem(WORKOUT_DRAFT_STORAGE_KEY, persisted(draftOf([se('a', [done])], { startedAt: 'not-a-date' })));
    await useWorkoutStore.persist.rehydrate();
    // Repaired to the earliest completedAt of a done set.
    expect(useWorkoutStore.getState().draft?.startedAt).toBe('2026-09-20T10:05:00.000Z');
  });
});

describe('F5 toggleSetDone needs a weight unless bodyweight', () => {
  beforeEach(() => localStorage.clear());

  it('refuses a 0 kg tytax / kettlebell / custom set, allows bodyweight', () => {
    const s = () => useWorkoutStore.getState();
    for (const [modality, allowed] of [['tytax', false], ['kettlebell', false], ['custom', false], ['bodyweight', true]] as const) {
      s().startQuick('p1', modality);
      const uid = s().addExercise(ex('x', [], { modality })) as string;
      const id = s().draft!.exercises[0].sets[0].id;
      s().updateSet(uid, id, { reps: 12 });
      s().toggleSetDone(uid, id);
      expect([modality, s().draft!.exercises[0].sets[0].done]).toEqual([modality, allowed]);
    }
  });
});

describe('F6 kettlebell prefill uses owned bells', () => {
  const swing = ex('swing', [], { modality: 'kettlebell' });
  const hist = (rir: number) => [log(3, [{ exerciseId: 'swing', modality: 'kettlebell', sets: [{ kg: 16, reps: 15, rir }] }])];
  const build = (rir: number, availableKg?: number[]) =>
    buildSessionExercise({ exercise: swing, history: hist(rir), settings: settings(), targetSets: 2, availableKg }).sets.map((s) => s.kg);

  it('snaps up to the lightest owned bell at or above the suggestion, else holds', () => {
    // 16 + 2.5 = 18.5 → lightest owned bell ≥ 18.5 = 20.
    expect(build(3, [12, 16, 20])).toEqual([20, 20]);
    // 16 + 1.25 = 17.25 → 20.
    expect(build(2, [12, 16, 20])).toEqual([20, 20]);
    // No owned bell ≥ 18.5 → hold last time's 16.
    expect(build(3, [12, 16])).toEqual([16, 16]);
    // RIR 1 → hold (no increment): 16 stays even though 16 is not owned.
    expect(build(1, [12, 20])).toEqual([16, 16]);
    // Without bells the prefill is unchanged.
    expect(build(3)).toEqual([18.5, 18.5]);
  });
});

describe('F7 weak point falls back below 90 impact', () => {
  const bench = ex('bench', [['Chest', 100]]);
  const lunge = ex('lunge', [['Quads', 85], ['Glutes', 50]], { name: 'Lunge' });
  const stepUp = ex('step-up', [['Quads', 70]], { name: 'Step Up' });
  const weak = ex('calf-ish', [['Quads', 59]], { name: 'Weak' });
  const history = [log(3, [{ exerciseId: 'bench', sets: [{ kg: 80, reps: 8 }] }])];
  const input = (catalogExercises: ReturnType<typeof ex>[]) => ({
    history, lookup: lookupOf(catalogExercises), catalogExercises, sessionExercises: [], settings: settings({ weakPointInjector: true }), now: NOW,
  });

  it('highest impact ≥ 60 when none reaches 90; null below 60', () => {
    expect(weakPoint(input([bench, stepUp, lunge]))?.exercise.id).toBe('lunge');
    expect(weakPoint(input([bench, weak]))).toBeNull();
  });
});

describe('F8 applyDeload never drops a done set', () => {
  it('drops the last undone working set; all done → set count unchanged', () => {
    const partly = se('p', [set('p1', { kg: 100, reps: 8, done: true }), set('p2', { kg: 100 }), set('p3', { kg: 100, reps: 6, done: true })]);
    const allDone = se('q', [set('q1', { kg: 100, reps: 8, done: true }), set('q2', { kg: 100, reps: 6, done: true })]);
    const [p, q] = applyDeload([partly, allDone]);
    // Done sets keep their logged kg; the one undone set is the one dropped.
    expect(p.sets.map((s) => [s.id, s.kg, s.done])).toEqual([['p1', 100, true], ['p3', 100, true]]);
    expect(q.sets.map((s) => [s.id, s.kg, s.done])).toEqual([['q1', 100, true], ['q2', 100, true]]);
  });
});

describe('F9 warm-ups use the heaviest working kg', () => {
  it('auto path: pyramid 60/70/80 @ RIR 3 → working 62.5/72.5/82.5, ladder from 82.5', () => {
    const history = [log(3, [{ exerciseId: 'row', sets: [{ kg: 60, reps: 10, rir: 3 }, { kg: 70, reps: 8, rir: 3 }, { kg: 80, reps: 6, rir: 3 }] }])];
    const out = buildSessionExercise({ exercise: ex('row', []), history, settings: settings(), targetSets: 3 });
    // standard 50 % × 10, 75 % × 5 of 82.5: 41.25 → 42.5, 61.875 → 62.5 (2.5 kg rounding).
    expect(out.sets.map((s) => [s.type, s.kg])).toEqual([
      ['warmup', 42.5], ['warmup', 62.5], ['working', 62.5], ['working', 72.5], ['working', 82.5],
    ]);
  });

  it('deload path: warm-ups regenerate from the heaviest deloaded kg', () => {
    const ex1 = se('r', [set('w', { type: 'warmup', kg: 20, reps: 10 }), set('a', { kg: 60 }), set('b', { kg: 100 }), set('c', { kg: 100 })]);
    const [out] = applyDeload([ex1], settings());
    // −1 set (c), ×0.85: 60 → 51 → 1.25 steps: 51/1.25 = 40.8 → 41 × 1.25 = 51.25; 100 → 85.
    // Ladder of the heaviest (85), 2.5 kg steps: 50 % = 42.5; 75 % = 63.75 → 25.5 → 26 × 2.5 = 65.
    expect(out.sets.map((s) => [s.type, s.kg])).toEqual([['warmup', 42.5], ['warmup', 65], ['working', 51.25], ['working', 85]]);
  });
});

describe('F10 persisted rest timer needs totalS > 0', () => {
  it('drops { totalS: 0 } with a future endsAt', async () => {
    const now = Date.now();
    localStorage.setItem(REST_TIMER_STORAGE_KEY, JSON.stringify({ version: 1, state: { timer: { endsAt: now + 60_000, totalS: 0 } } }));
    await useRestTimerStore.persist.rehydrate();
    const t = useRestTimerStore.getState().timer;
    expect(t).toBeNull();
    expect([restRemaining(t, now), restProgress(t, now)]).toEqual([0, 0]);
  });
});

describe('F1 syncAcrossTabs listener lifecycle', () => {
  it('re-reads on its key, a clear and a visible tab; stops after unsubscribe', async () => {
    const { syncAcrossTabs } = await import('../cross-tab');
    const rehydrate = vi.fn();
    const off = syncAcrossTabs('k.test', rehydrate);
    window.dispatchEvent(new StorageEvent('storage', { key: 'other' }));
    expect(rehydrate).toHaveBeenCalledTimes(0);
    window.dispatchEvent(new StorageEvent('storage', { key: 'k.test' }));
    window.dispatchEvent(new StorageEvent('storage', { key: null }));
    document.dispatchEvent(new Event('visibilitychange'));
    expect(rehydrate).toHaveBeenCalledTimes(document.visibilityState === 'visible' ? 3 : 2);
    off();
    window.dispatchEvent(new StorageEvent('storage', { key: 'k.test' }));
    document.dispatchEvent(new Event('visibilitychange'));
    expect(rehydrate).toHaveBeenCalledTimes(document.visibilityState === 'visible' ? 3 : 2);
  });
});
