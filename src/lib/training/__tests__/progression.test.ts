import { describe, expect, it } from 'vitest';
import { prefillFromHistory, training } from '../index';
import { logEndingAt } from './helpers';

const NOW = new Date('2026-09-20T10:00:00Z');
const PRESS = 'press';

describe('prefillFromHistory', () => {
  it('RIR ≥ 3 on every set → +2.5 kg with ghost kg/reps per set', () => {
    const log = logEndingAt(NOW, 48, [
      { exerciseId: PRESS, sets: [{ kg: 60, reps: 10, rir: 3 }, { kg: 60, reps: 9, rir: 4 }, { kg: 60, reps: 8, rir: 3 }] },
    ]);
    const r = prefillFromHistory(PRESS, [log]);
    // min RIR = min(3, 4, 3) = 3 ≥ 3 → +2.5: 60 + 2.5 = 62.5
    expect(r.basis).toBe('rir3plus');
    expect(r.suggestedKg).toBe(62.5);
    // 3 done working sets last time → 3 sets
    expect(r.sets.map((s) => s.kg)).toEqual([62.5, 62.5, 62.5]);
    expect(r.sets.map((s) => s.ghostKg)).toEqual([60, 60, 60]);
    expect(r.sets.map((s) => s.ghostReps)).toEqual([10, 9, 8]);
    expect(r.sets.every((s) => s.reps === 0 && !s.done && s.type === 'working')).toBe(true);
    expect(r.sourceLogId).toBe(log.id);
  });

  it('lowest RIR exactly 2 → +1.25 kg', () => {
    const log = logEndingAt(NOW, 72, [{ exerciseId: PRESS, sets: [{ kg: 80, reps: 6, rir: 2 }, { kg: 80, reps: 5, rir: 3 }] }]);
    const r = training.prefillFromHistory(PRESS, [log]);
    // min RIR = min(2, 3) = 2 → +1.25: 80 + 1.25 = 81.25
    expect(r.basis).toBe('rir2');
    expect(r.suggestedKg).toBe(81.25);
    expect(r.sets.map((s) => s.kg)).toEqual([81.25, 81.25]);
  });

  it('lowest RIR 1 → hold the same weight', () => {
    const log = logEndingAt(NOW, 72, [{ exerciseId: PRESS, sets: [{ kg: 100, reps: 5, rir: 3 }, { kg: 100, reps: 5, rir: 1 }] }]);
    const r = prefillFromHistory(PRESS, [log]);
    // min RIR = min(3, 1) = 1 → +0: 100
    expect(r.basis).toBe('hold');
    expect(r.suggestedKg).toBe(100);
    expect(r.sets.map((s) => s.kg)).toEqual([100, 100]);
  });

  it('no RIR recorded → hold', () => {
    const log = logEndingAt(NOW, 72, [{ exerciseId: PRESS, sets: [{ kg: 70, reps: 8 }] }]);
    const r = prefillFromHistory(PRESS, [log]);
    // no rir → +0: 70
    expect(r.basis).toBe('hold');
    expect(r.suggestedKg).toBe(70);
    expect(r.sets).toHaveLength(1);
  });

  it('ghost reps per set index; extra sets reuse the last set kg without a ghost', () => {
    const log = logEndingAt(NOW, 24, [{ exerciseId: PRESS, sets: [{ kg: 50, reps: 12, rir: 3 }, { kg: 55, reps: 10, rir: 4 }] }]);
    const r = prefillFromHistory(PRESS, [log], { targetSets: 3 });
    // min RIR 3 → +2.5: set0 50+2.5 = 52.5, set1 55+2.5 = 57.5, set2 = last kg 55+2.5 = 57.5
    expect(r.sets.map((s) => s.kg)).toEqual([52.5, 57.5, 57.5]);
    expect(r.sets.map((s) => s.ghostReps)).toEqual([12, 10, undefined]);
    expect(r.sets.map((s) => s.ghostKg)).toEqual([50, 55, undefined]);
    // fewer sets than last time keeps the first ones
    const one = prefillFromHistory(PRESS, [log], { targetSets: 1 });
    expect(one.sets.map((s) => [s.kg, s.ghostReps])).toEqual([[52.5, 12]]);
  });

  it('no history → targetSets empty sets at 0 kg, basis none', () => {
    const r = prefillFromHistory(PRESS, []);
    // default targetSets 1
    expect(r).toMatchObject({ basis: 'none', suggestedKg: 0 });
    expect(r.sourceLogId).toBeUndefined();
    expect(r.sets).toHaveLength(1);
    expect(r.sets[0]).toMatchObject({ kg: 0, reps: 0, done: false, type: 'working' });
    expect(prefillFromHistory(PRESS, [], { targetSets: 3 }).sets).toHaveLength(3);
    const other = logEndingAt(NOW, 24, [{ exerciseId: 'curl', sets: [{ kg: 20, reps: 10, rir: 3 }] }]);
    expect(prefillFromHistory(PRESS, [other]).basis).toBe('none');
  });

  it('ignores a soft-deleted newest log and picks the newest by startedAt in any order', () => {
    const old = logEndingAt(NOW, 24 * 10, [{ exerciseId: PRESS, sets: [{ kg: 40, reps: 10, rir: 3 }] }]);
    const mid = logEndingAt(NOW, 24 * 3, [{ exerciseId: PRESS, sets: [{ kg: 60, reps: 10, rir: 3 }] }]);
    const deleted = logEndingAt(NOW, 24, [{ exerciseId: PRESS, sets: [{ kg: 100, reps: 10, rir: 3 }] }], { deleted: true });
    const r = prefillFromHistory(PRESS, [deleted, old, mid]);
    // newest live log is `mid` (3 days ago): 60 + 2.5 = 62.5
    expect(r.sourceLogId).toBe(mid.id);
    expect(r.suggestedKg).toBe(62.5);
    expect(r.sets[0].ghostKg).toBe(60);
  });

  it('warm-ups and undone sets are excluded from sets and RIR', () => {
    const log = logEndingAt(NOW, 24, [
      {
        exerciseId: PRESS,
        sets: [
          { kg: 40, reps: 10, rir: 5, type: 'warmup' },
          { kg: 70, reps: 8, rir: 2 },
          { kg: 90, reps: 3, rir: 0, done: false },
        ],
      },
    ]);
    const r = prefillFromHistory(PRESS, [log]);
    // only 70×8 @ RIR 2 counts → +1.25 = 71.25, 1 set, ghost 70×8
    expect(r.basis).toBe('rir2');
    expect(r.sets).toHaveLength(1);
    expect(r.sets[0]).toMatchObject({ kg: 71.25, ghostKg: 70, ghostReps: 8 });
  });

  it('a newer log where the exercise was never done does not reset progression', () => {
    const done = logEndingAt(NOW, 24 * 4, [{ exerciseId: PRESS, sets: [{ kg: 60, reps: 10, rir: 3 }] }]);
    const skipped = logEndingAt(NOW, 24, [{ exerciseId: PRESS, sets: [{ kg: 62.5, reps: 0, done: false }] }]);
    const r = prefillFromHistory(PRESS, [skipped, done]);
    // falls back to `done`: 60 + 2.5 = 62.5
    expect(r.sourceLogId).toBe(done.id);
    expect(r.suggestedKg).toBe(62.5);
  });

  it('collects done sets across every occurrence of the exercise in order', () => {
    const log = logEndingAt(NOW, 24, [
      { exerciseId: PRESS, sets: [{ kg: 60, reps: 10, rir: 3 }] },
      { exerciseId: 'curl', sets: [{ kg: 20, reps: 10, rir: 0 }] },
      { exerciseId: PRESS, sets: [{ kg: 65, reps: 8, rir: 2 }] },
    ]);
    const r = prefillFromHistory(PRESS, [log]);
    // sets [60×10 @3, 65×8 @2] → min RIR 2 → +1.25: 61.25, 66.25 (curl's RIR 0 is ignored)
    expect(r.basis).toBe('rir2');
    expect(r.sets.map((s) => s.kg)).toEqual([61.25, 66.25]);
    expect(r.sets.map((s) => s.ghostReps)).toEqual([10, 8]);
  });
});
