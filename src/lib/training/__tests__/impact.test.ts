import { describe, expect, it } from 'vitest';
import type { WorkoutLog } from '@/contracts/domain';
import { IDEAL_DISTRIBUTION, impactDistribution, laggingMuscle, training } from '../index';
import { logEndingAt, lookup, sets } from './helpers';

const NOW = new Date('2026-09-20T12:00:00Z');

describe('impactDistribution', () => {
  it('each done working set adds score/100 per muscle, normalised to 1', () => {
    const log = logEndingAt(NOW, 24, [{ exerciseId: 'press', sets: sets(2) }]);
    const d = impactDistribution([log], lookup);
    // Chest 2×1.0 = 2, Triceps 2×0.5 = 1, total 3 → 2/3 and 1/3
    expect(d.Chest).toBeCloseTo(2 / 3, 10);
    expect(d.Triceps).toBeCloseTo(1 / 3, 10);
    expect(Object.keys(d).sort()).toEqual(['Chest', 'Triceps']);
  });

  it('excludes warm-ups, undone sets and soft-deleted logs', () => {
    const live = logEndingAt(NOW, 24, [
      {
        exerciseId: 'press',
        sets: [{ kg: 50, reps: 10 }, { kg: 20, reps: 10, type: 'warmup' }, { kg: 60, reps: 5, done: false }],
      },
      { exerciseId: 'curl', sets: [{ kg: 10, reps: 10, type: 'warmup' }] },
    ]);
    const deleted = logEndingAt(NOW, 48, [{ exerciseId: 'curl', sets: sets(5) }], { deleted: true });
    const d = impactDistribution([live, deleted], lookup);
    // only 1 press set counts: Chest 1, Triceps 0.5 → 1/1.5 = 2/3, 0.5/1.5 = 1/3; no Biceps
    expect(d.Chest).toBeCloseTo(2 / 3, 10);
    expect(d.Triceps).toBeCloseTo(1 / 3, 10);
    expect(d.Biceps).toBeUndefined();
  });

  it('standardises names; duplicate muscles in one exercise count once (max); unknown names pass through', () => {
    const log = logEndingAt(NOW, 24, [
      { exerciseId: 'row', sets: sets(1) },
      { exerciseId: 'calf', sets: sets(1) },
      { exerciseId: 'run', sets: sets(1) },
    ]);
    const d = impactDistribution([log], lookup);
    // row: Lats .8, Mid Back→Rhomboids .4; calf: Gastrocnemius .8 & Soleus .6 → Calves max .8; run: Cardio .5
    // total = .8 + .4 + .8 + .5 = 2.5 → Lats .32, Rhomboids .16, Calves .32, Cardio .2
    expect(d.Lats).toBeCloseTo(0.32, 10);
    expect(d.Rhomboids).toBeCloseTo(0.16, 10);
    expect(d.Calves).toBeCloseTo(0.32, 10);
    expect(d.Cardio).toBeCloseTo(0.2, 10);
  });

  it('falls back to the log snapshot when the catalog has no entry', () => {
    const base = logEndingAt(NOW, 24, [{ exerciseId: 'custom-1', sets: sets(3) }]);
    const log: WorkoutLog = {
      ...base,
      exercises: base.exercises.map((e) => ({ ...e, muscleImpactSnapshot: [{ muscle: 'chest', score: 80 }, { muscle: 'Quads (stability)', score: 20 }] })),
    };
    const d = training.impactDistribution([log], lookup);
    // 3 sets: chest→Chest 3×.8 = 2.4, Quads (stability)→Quads 3×.2 = .6, total 3 → .8 / .2
    expect(d.Chest).toBeCloseTo(0.8, 10);
    expect(d.Quads).toBeCloseTo(0.2, 10);
  });

  it('filters by the inclusive calendar-day range', () => {
    const a = logEndingAt(NOW, 72, [{ exerciseId: 'press', sets: sets(1) }], { date: '2026-09-10' });
    const b = logEndingAt(NOW, 48, [{ exerciseId: 'curl', sets: sets(1) }], { date: '2026-09-11' });
    const c = logEndingAt(NOW, 24, [{ exerciseId: 'row', sets: sets(1) }], { date: '2026-09-12' });
    // only b (2026-09-11) is inside [09-11, 09-11] → Biceps 1.0
    expect(impactDistribution([a, b, c], lookup, { from: '2026-09-11', to: '2026-09-11' })).toEqual({ Biceps: 1 });
    // from 09-12 → only c: Lats .8 / 1.2 = 2/3
    expect(impactDistribution([a, b, c], lookup, { from: '2026-09-12' }).Lats).toBeCloseTo(2 / 3, 10);
    // to 09-10 → only a
    expect(Object.keys(impactDistribution([a, b, c], lookup, { to: '2026-09-10' })).sort()).toEqual(['Chest', 'Triceps']);
  });

  it('no counted sets → {}', () => {
    expect(impactDistribution([], lookup)).toEqual({});
    const warm = logEndingAt(NOW, 24, [{ exerciseId: 'press', sets: [{ kg: 20, reps: 10, type: 'warmup' }] }]);
    expect(impactDistribution([warm], lookup)).toEqual({});
  });
});

describe('laggingMuscle', () => {
  it('returns the largest positive gap', () => {
    const r = laggingMuscle({ Chest: 0.5, Triceps: 0.5 }, { Chest: 0.4, Triceps: 0.3, Quads: 0.3 });
    // gaps: Chest .4-.5 = -.1, Triceps .3-.5 = -.2, Quads .3-0 = .3 → Quads
    expect(r).toEqual({ muscle: 'Quads', actualShare: 0, targetShare: 0.3, gap: 0.3 });
  });

  it('null when nothing is under target or nothing was trained', () => {
    expect(laggingMuscle({ A: 0.5, B: 0.5 }, { A: 0.5, B: 0.5 })).toBeNull();
    expect(laggingMuscle({}, { A: 1 })).toBeNull();
    expect(laggingMuscle({})).toBeNull();
  });

  it('defaults to IDEAL_DISTRIBUTION, which sums to 1', () => {
    const sum = Object.values(IDEAL_DISTRIBUTION).reduce((a, b) => a + b, 0);
    // .12+.10+.05+.05+.03+.04+.06+.04+.06+.07+.02+.12+.08+.08+.04+.04 = 1
    expect(sum).toBeCloseTo(1, 10);
    const r = training.laggingMuscle({ Chest: 1 });
    // Chest gap .12-1 < 0; the largest other target is Quads .12 (gap .12 - 0 = .12)
    expect(r?.muscle).toBe('Quads');
    expect(r?.gap).toBeCloseTo(0.12, 10);
  });
});
