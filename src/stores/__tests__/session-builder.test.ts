import { describe, it, expect } from 'vitest';
import type { Program, ProgramExercise } from '@/contracts/domain';
import { applyDeload, buildProgramSession, buildSessionExercise, deloadOffer, wrapIndex } from '../session-builder';
import { NOW, ex, log, lookupOf, settings } from './g3-helpers';

const bench = ex('bench', [['Chest', 100], ['Triceps', 50]], { restSeconds: 120, defaultSets: 4 });
const kgs = (sets: { kg: number }[]) => sets.map((s) => s.kg);
const types = (sets: { type: string }[]) => sets.map((s) => s.type);

describe('buildSessionExercise', () => {
  it('prefills +2.5 kg after RIR 3 and prepends standard warm-ups', () => {
    const history = [log(3, [{ exerciseId: 'bench', sets: [{ kg: 100, reps: 8, rir: 3 }, { kg: 100, reps: 7, rir: 3 }, { kg: 100, reps: 6, rir: 3 }] }])];
    const se = buildSessionExercise({ exercise: bench, history, settings: settings() });
    // Working: 100 + 2.5 (lowest RIR 3 → rir3plus) = 102.5 for each of last time's 3 sets.
    // Warm-ups (standard, bar 20, round 2.5): 102.5×0.5 = 51.25 → 52.5 ×10; 102.5×0.75 = 76.875 → 77.5 ×5.
    expect(types(se.sets)).toEqual(['warmup', 'warmup', 'working', 'working', 'working']);
    expect(kgs(se.sets)).toEqual([52.5, 77.5, 102.5, 102.5, 102.5]);
    expect(se.sets.map((s) => s.reps)).toEqual([10, 5, 0, 0, 0]);
    expect(se.sets.slice(2).map((s) => [s.ghostKg, s.ghostReps])).toEqual([[100, 8], [100, 7], [100, 6]]);
    expect(se.sets.every((s) => !s.done)).toBe(true);
    expect(se.restSeconds).toBe(120);
    expect(se.muscleImpactSnapshot).toEqual([{ muscle: 'Chest', score: 100 }, { muscle: 'Triceps', score: 50 }]);
    expect(se.exerciseName).toBe('bench');
  });

  it('RIR 2 → +1.25 kg; RIR 1 → hold', () => {
    const rir2 = buildSessionExercise({ exercise: bench, history: [log(2, [{ exerciseId: 'bench', sets: [{ kg: 100, reps: 8, rir: 2 }] }])], settings: settings({ warmupStrategy: 'none' }) });
    expect(kgs(rir2.sets)).toEqual([101.25]); // 100 + 1.25
    const rir1 = buildSessionExercise({ exercise: bench, history: [log(2, [{ exerciseId: 'bench', sets: [{ kg: 100, reps: 8, rir: 1 }] }])], settings: settings({ warmupStrategy: 'none' }) });
    expect(kgs(rir1.sets)).toEqual([100]);
  });

  it('without history: min(defaultSets, 3) empty sets, no warm-ups, no rest', () => {
    const se = buildSessionExercise({ exercise: ex('fly', [['Chest', 90]], { defaultSets: 5 }), history: [], settings: settings() });
    expect(types(se.sets)).toEqual(['working', 'working', 'working']);
    expect(kgs(se.sets)).toEqual([0, 0, 0]);
    expect(se.restSeconds).toBeUndefined();
    const two = buildSessionExercise({ exercise: ex('fly', [], { defaultSets: 2 }), history: [], settings: settings() });
    expect(two.sets).toHaveLength(2);
    const zero = buildSessionExercise({ exercise: ex('fly', [], { defaultSets: 0 }), history: [], settings: settings() });
    expect(zero.sets).toHaveLength(3);
  });

  it('slot wins for id, name, set count, rest and superset; targetSets wins over everything', () => {
    const slot: ProgramExercise = { exerciseId: 'bench', exerciseName: 'Bench (slot)', modality: 'tytax', sets: 4, reps: '6-8', restSeconds: 150, supersetGroup: 'A' };
    const history = [log(3, [{ exerciseId: 'bench', sets: [{ kg: 60, reps: 8 }] }])];
    const se = buildSessionExercise({ slot, exercise: bench, history, settings: settings({ warmupStrategy: 'none' }) });
    // One set last time, 4 requested: all four take 60 (hold, no RIR); only set 1 has a ghost.
    expect(kgs(se.sets)).toEqual([60, 60, 60, 60]);
    expect(se.sets.map((s) => s.ghostReps)).toEqual([8, undefined, undefined, undefined]);
    expect([se.exerciseName, se.restSeconds, se.supersetGroup]).toEqual(['Bench (slot)', 150, 'A']);
    const two = buildSessionExercise({ slot, history, settings: settings(), targetSets: 2, warmups: false });
    expect(types(two.sets)).toEqual(['working', 'working']);
    expect(two.muscleImpactSnapshot).toBeUndefined();
  });

  it('no warm-ups for bodyweight/kettlebell, and heavy strategy uses its ladder', () => {
    const history = [log(3, [{ exerciseId: 'kb', sets: [{ kg: 24, reps: 10 }] }, { exerciseId: 'bench', sets: [{ kg: 100, reps: 5 }] }])];
    const kb = buildSessionExercise({ exercise: ex('kb', [], { modality: 'kettlebell' }), history, settings: settings() });
    expect(types(kb.sets)).toEqual(['working']);
    const heavy = buildSessionExercise({ exercise: bench, history, settings: settings({ warmupStrategy: 'heavy' }) });
    // 100 hold: 50 ×10, 75 ×5, 85 ×3, 95 ×1 (all multiples of 2.5).
    expect(kgs(heavy.sets)).toEqual([50, 75, 85, 95, 100]);
  });

  it('throws without an exercise or slot', () => {
    expect(() => buildSessionExercise({ history: [], settings: settings() })).toThrow();
  });
});

function program(): Program {
  const slot = (id: string, sets: number): ProgramExercise => ({ exerciseId: id, exerciseName: id, modality: 'tytax', sets, reps: '8-12' });
  return {
    id: 'prog', profileId: 'p1', name: 'P', splitType: 'custom', frequency: 3, periodizationType: 'none', sessionOrder: [],
    sessions: [
      { id: 's0', programId: 'prog', name: 'Upper', dayIndex: 0, exercises: [slot('bench', 3), slot('row', 2)] },
      { id: 's1', programId: 'prog', name: 'Rest', dayIndex: 1, exercises: [], isRest: true },
      { id: 's2', programId: 'prog', name: 'Empty', dayIndex: 2, exercises: [] },
    ],
    modalitiesUsed: ['tytax'], isPreset: false, currentSessionIndex: 0, createdAt: '', updatedAt: '',
  };
}

describe('buildProgramSession', () => {
  it('builds each slot with its own history; wraps the index', () => {
    const history = [log(3, [{ exerciseId: 'bench', sets: [{ kg: 100, reps: 8, rir: 3 }] }])];
    const built = buildProgramSession({ program: program(), sessionIndex: 3, historyByExercise: { bench: history }, settings: settings(), lookup: lookupOf([bench]) });
    expect(built?.sessionIndex).toBe(0);
    expect(built?.sessionName).toBe('Upper');
    expect(built?.programSessionId).toBe('s0');
    // bench: 3 slot sets at 102.5 + 2 warm-ups (52.5, 77.5); row: no history → 2 empty sets.
    expect(kgs(built?.exercises[0].sets ?? [])).toEqual([52.5, 77.5, 102.5, 102.5, 102.5]);
    expect(kgs(built?.exercises[1].sets ?? [])).toEqual([0, 0]);
    expect(built?.exercises[0].muscleImpactSnapshot?.[0].muscle).toBe('Chest');
  });

  it('null for rest, empty and session-less programs', () => {
    const base = { historyByExercise: {}, settings: settings(), lookup: lookupOf([]) };
    expect(buildProgramSession({ ...base, program: program(), sessionIndex: 1 })).toBeNull();
    expect(buildProgramSession({ ...base, program: program(), sessionIndex: -1 })).toBeNull();
    expect(buildProgramSession({ ...base, program: { ...program(), sessions: [] }, sessionIndex: 0 })).toBeNull();
    expect(wrapIndex(5, 0)).toBe(0);
  });
});

describe('deload', () => {
  it('offers only when recovery is fried', () => {
    const lookup = lookupOf([bench]);
    const six = Array.from({ length: 6 }, () => ({ kg: 100, reps: 5 }));
    // 6 done sets × Chest 1.0 within 48 h → load 6 ≥ RECOVERY_FRIED_LOAD → fried.
    const fried = deloadOffer({ history: [log(1, [{ exerciseId: 'bench', sets: six }])], lookup, now: NOW });
    expect(fried.offer).toBe(true);
    expect(fried.recovery.overall).toBe('fried');
    // 5 sets → 5 < 6 → recovering, no offer.
    const recovering = deloadOffer({ history: [log(1, [{ exerciseId: 'bench', sets: six.slice(1) }])], lookup, now: NOW });
    expect([recovering.offer, recovering.recovery.overall]).toEqual([false, 'recovering']);
  });

  it('102.5 ×3 → 2 sets at 87.5 with warm-ups regenerated from 87.5', () => {
    const history = [log(3, [{ exerciseId: 'bench', sets: [{ kg: 100, reps: 8, rir: 3 }, { kg: 100, reps: 8, rir: 3 }, { kg: 100, reps: 8, rir: 3 }] }])];
    const se = buildSessionExercise({ exercise: bench, history, settings: settings() });
    const [out] = applyDeload([se], settings());
    // 102.5 × 0.85 = 87.125 → round 1.25 → 87.5; 3 sets − 1 = 2.
    // Warm-ups from 87.5: ×0.5 = 43.75 → 45 ×10; ×0.75 = 65.625 → 65 ×5.
    expect(kgs(out.sets)).toEqual([45, 65, 87.5, 87.5]);
    expect(types(out.sets)).toEqual(['warmup', 'warmup', 'working', 'working']);
    expect(kgs(se.sets)).toEqual([52.5, 77.5, 102.5, 102.5, 102.5]); // input untouched
  });

  it('without settings keeps only warm-ups lighter than the deloaded weight', () => {
    const se = {
      uid: 'u', exerciseId: 'x', exerciseName: 'x', modality: 'tytax' as const,
      sets: [
        { id: 'w1', type: 'warmup' as const, kg: 40, reps: 10, done: false },
        { id: 'w2', type: 'warmup' as const, kg: 60, reps: 5, done: false },
        { id: 'a', type: 'working' as const, kg: 60, reps: 0, done: false },
      ],
    };
    // 60 × 0.85 = 51 → 51.25; only set, so not removed; warm-up 60 ≥ 51.25 dropped.
    expect(kgs(applyDeload([se])[0].sets)).toEqual([40, 51.25]);
    const plain = { ...se, sets: [se.sets[2]] };
    expect(kgs(applyDeload([plain])[0].sets)).toEqual([51.25]);
  });
});
