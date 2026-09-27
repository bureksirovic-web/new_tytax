/**
 * Hardening round 2 (DSH refuter on Wave 2 at dc5b5d1): findings 1, 4, 5 and 7
 * reproduced at store / builder / adapter level. Each test failed on 7669a4e.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { MachineSetup, SessionExercise, SetEntry, WorkoutLog } from '@/contracts/domain';
import type { Repository } from '@/contracts/repo';
import { useWorkoutStore } from '../workout-store';
import { buildSessionExercise } from '../session-builder';
import { draftFromLog } from '../draft-ops';
import { canSaveSetup, saveSetup } from '../setup-adapter';
import { ex, log, settings } from './g3-helpers';

const store = () => useWorkoutStore.getState();
const set = (id: string, over: Partial<SetEntry> = {}): SetEntry => ({ id, type: 'working', kg: 0, reps: 0, done: false, ...over });
const se = (uid: string, sets: SetEntry[], over: Partial<SessionExercise> = {}): SessionExercise => ({
  uid, exerciseId: uid, exerciseName: uid, modality: 'tytax', sets, ...over,
});
const setOf = (uid: string, id: string) => {
  const s = store().draft?.exercises.find((e) => e.uid === uid)?.sets.find((x) => x.id === id);
  if (!s) throw new Error('expected a set');
  return s;
};

const hold = ex('hold', [['Forearms', 90]], { measure: 'time', defaultReps: '20-40s', defaultSets: 2 });

function heldLog(seconds: number[]): WorkoutLog {
  const l = log(1, [{ exerciseId: 'hold', sets: seconds.map(() => ({ kg: 0, reps: 0, done: true })) }]);
  l.exercises[0].sets.forEach((s, i) => {
    s.durationSeconds = seconds[i];
  });
  return l;
}

describe('refuter F1 — last session’s hold is a placeholder, never the value', () => {
  beforeEach(() => {
    store().discard();
    localStorage.clear();
  });

  it('prefill puts the hold only in ghostDurationSeconds; durationSeconds stays undefined', () => {
    const out = buildSessionExercise({ exercise: hold, history: [heldLog([45, 20])], settings: settings(), targetSets: 3 });
    expect(out.sets.map((s) => s.durationSeconds)).toEqual([undefined, undefined, undefined]);
    expect(out.sets.map((s) => s.ghostDurationSeconds)).toEqual([45, 20, undefined]);
  });

  it('done on an empty duration adopts the ghost (explicit tap, like ghost reps); without a ghost nothing happens', () => {
    store().startDraft({ profileId: 'p', sessionName: 'S', exercises: [se('hold', [set('a', { ghostDurationSeconds: 45 }), set('b')])] });
    store().toggleTimeSetDone('hold', 'a');
    expect(setOf('hold', 'a')).toMatchObject({ done: true, durationSeconds: 45 });
    store().toggleTimeSetDone('hold', 'b');
    expect(setOf('hold', 'b').done).toBe(false);
    expect(setOf('hold', 'b').durationSeconds).toBeUndefined();
    // The card's fallback ghost (last session by index) is adopted the same way.
    store().toggleTimeSetDone('hold', 'b', 30);
    expect(setOf('hold', 'b')).toMatchObject({ done: true, durationSeconds: 30 });
  });

  it('addSet on a time exercise copies no duration value (the previous hold becomes the hint)', () => {
    store().startDraft({ profileId: 'p', sessionName: 'S', exercises: [se('hold', [set('a', { durationSeconds: 50, done: true })])] });
    store().addSet('hold');
    const added = store().draft!.exercises[0].sets[1];
    expect(added.durationSeconds).toBeUndefined();
    expect(added.ghostDurationSeconds).toBe(50);
  });
});

describe('refuter F4 — updateSet never erases logged rep work because of the measure', () => {
  beforeEach(() => {
    store().discard();
    localStorage.clear();
  });

  it("an RIR edit with measure 'time' keeps a done 100 kg × 5 set done", () => {
    store().startDraft({ profileId: 'p', sessionName: 'S', exercises: [se('bench', [set('b1', { kg: 100, reps: 5, done: true, completedAt: 'c' })])] });
    store().updateSet('bench', 'b1', { rir: 2 }, 'time');
    expect(setOf('bench', 'b1')).toMatchObject({ done: true, completedAt: 'c', rir: 2 });
  });

  it("a done time set cleared to 0 s is undone even with measure 'reps'", () => {
    store().startDraft({ profileId: 'p', sessionName: 'S', exercises: [se('hold', [set('t1', { durationSeconds: 30, done: true, completedAt: 'c' })])] });
    store().updateSet('hold', 't1', { durationSeconds: 0 }, 'reps');
    expect(setOf('hold', 't1').done).toBe(false);
  });
});

describe('refuter F5 — repeat workout of a time exercise carries no kg/reps and no duration value', () => {
  it('a pre-Wave-2 hold logged as reps 45: with the catalog measure, kg/reps reset, no rep ghosts', () => {
    const l = log(1, [{ exerciseId: 'hold', sets: [{ kg: 0, reps: 45, done: true }] }]);
    const d = draftFromLog('p', l, '2026-09-27T10:00:00.000Z', () => 'time');
    expect(d.exercises[0].sets[0]).toEqual({ id: d.exercises[0].sets[0].id, type: 'working', kg: 0, reps: 0, done: false });
  });

  it('a log set with durationSeconds is a time set even without a lookup: the hold is the ghost only', () => {
    const l = heldLog([45]);
    l.exercises[0].sets[0].kg = 20;
    l.exercises[0].sets[0].reps = 3;
    const d = draftFromLog('p', l, '2026-09-27T10:00:00.000Z');
    expect(d.exercises[0].sets[0]).toEqual({ id: d.exercises[0].sets[0].id, type: 'working', kg: 0, reps: 0, done: false, ghostDurationSeconds: 45 });
  });

  it('reps exercises keep kg/reps and their ghosts', () => {
    const l = log(1, [{ exerciseId: 'bench', sets: [{ kg: 100, reps: 5, done: true }] }]);
    const d = draftFromLog('p', l, '2026-09-27T10:00:00.000Z', () => 'reps');
    expect(d.exercises[0].sets[0]).toMatchObject({ kg: 100, reps: 5, ghostKg: 100, ghostReps: 5 });
  });
});

describe('refuter F7 — setup writer matches G2’s notes.setSetup exactly', () => {
  /** Shaped like g2/src/lib/db/repo/notes.ts `NotesRepoExt`: getSetup + setSetup(p, e, MachineSetup | null). */
  function g2Repo(): { repo: Repository; calls: Array<MachineSetup | null> } {
    const calls: Array<MachineSetup | null> = [];
    const notes = {
      get: vi.fn(), set: vi.fn(), list: vi.fn(),
      getSetup: vi.fn(async () => undefined),
      setSetup: vi.fn(async (_p: string, _e: string, s: MachineSetup | null) => {
        if (s !== null && typeof s !== 'object') throw new Error('bad');
        calls.push(s);
        return undefined;
      }),
    };
    return { repo: { notes } as unknown as Repository, calls };
  }

  it('clearing passes null (G2 signature), saving passes the cleaned setup', async () => {
    const { repo, calls } = g2Repo();
    expect(canSaveSetup(repo)).toBe(true);
    expect(await saveSetup(repo, 'p', 'e', { seat: ' 4 ' })).toEqual({ saved: true, setup: { seat: '4' } });
    expect(await saveSetup(repo, 'p', 'e', { seat: '  ' })).toEqual({ saved: true, setup: undefined });
    expect(calls).toEqual([{ seat: '4' }, null]);
  });

  it('a repo-level setSetup (not G2’s shape) or a notes.setSetup without getSetup is not a writer', () => {
    const top = { notes: { get: vi.fn() }, setSetup: vi.fn() } as unknown as Repository;
    expect(canSaveSetup(top)).toBe(false);
    const half = { notes: { get: vi.fn(), setSetup: vi.fn() } } as unknown as Repository;
    expect(canSaveSetup(half)).toBe(false);
  });
});

describe('refuter F2 — a removed set, exercise or workout leaves no stored hold behind', () => {
  beforeEach(() => {
    store().discard();
    sessionStorage.clear();
  });

  it('removeSet, removeExercise and discard clear the hold keys of the sets they drop', () => {
    store().startDraft({ profileId: 'p', sessionName: 'S', exercises: [se('hold', [set('a'), set('b')]), se('plank', [set('c')])] });
    for (const id of ['a', 'b', 'c']) sessionStorage.setItem(`tytax-hold:${id}`, '1000');
    sessionStorage.setItem('other-key', 'kept');
    store().removeSet('hold', 'a');
    expect(sessionStorage.getItem('tytax-hold:a')).toBeNull();
    expect(sessionStorage.getItem('tytax-hold:b')).toBe('1000');
    store().removeExercise('plank');
    expect(sessionStorage.getItem('tytax-hold:c')).toBeNull();
    expect(sessionStorage.getItem('tytax-hold:b')).toBe('1000');
    store().discard();
    expect(sessionStorage.getItem('tytax-hold:b')).toBeNull();
    expect(sessionStorage.getItem('other-key')).toBe('kept');
  });
});

describe('refuter F5 — a stray durationSeconds 0 does not make a rep exercise a time exercise', () => {
  it('without a lookup, a log whose sets carry durationSeconds 0 repeats as reps', () => {
    const l = log(1, [{ exerciseId: 'bench', sets: [{ kg: 100, reps: 5, done: true }] }]);
    l.exercises[0].sets[0].durationSeconds = 0;
    const d = draftFromLog('p', l, '2026-09-27T00:00:00.000Z');
    expect(d.exercises[0].sets[0]).toMatchObject({ kg: 100, reps: 5, ghostKg: 100, ghostReps: 5 });
    expect('durationSeconds' in d.exercises[0].sets[0]).toBe(false);
  });
});
