import { describe, expect, it } from 'vitest';
import type { Exercise, SessionExercise, SetEntry } from '@/contracts/domain';
import type { ExerciseLookup } from '@/contracts/training';
import {
  acwr,
  detectPRs,
  holdSeconds,
  impactDistribution,
  isDoneWorkingSet,
  isTimeSet,
  laggingMuscle,
  logHoldSeconds,
  prefillFromHistory,
  rankableE1rm,
  recoveryStatus,
} from '../index';
import { TEST_EXERCISES, logEndingAt, lookup, sets, withDurations } from './helpers';

const NOW = new Date('2026-09-20T10:00:00Z');

/** plank: a time-measured exercise hitting Core 100. */
const PLANK: Exercise = { ...TEST_EXERCISES.curl, id: 'plank', name: 'plank', measure: 'time', impact: [{ muscle: 'Core', score: 100 }] };
const lookupWithPlank: ExerciseLookup = (id) => (id === 'plank' ? PLANK : lookup(id));

let n = 0;
function set(kg: number, reps: number, extra: Partial<SetEntry> = {}): SetEntry {
  n += 1;
  return { id: `t${n}`, type: 'working', kg, reps, done: true, ...extra };
}
function exercise(exerciseId: string, list: SetEntry[]): SessionExercise {
  return { uid: `u-${exerciseId}`, exerciseId, exerciseName: exerciseId, modality: 'tytax', sets: list };
}

/** A plank log ending `hoursAgo` before NOW with two done 0 kg × 0 rep time sets of 45 s and 30 s. */
function plankLog(hoursAgo: number) {
  return withDurations(logEndingAt(NOW, hoursAgo, [{ exerciseId: 'plank', sets: [{ kg: 0, reps: 0 }, { kg: 0, reps: 0 }] }]), [45, 30]);
}

describe('isTimeSet / isDoneWorkingSet', () => {
  it('a time set is one with durationSeconds > 0', () => {
    expect(isTimeSet(set(0, 0, { durationSeconds: 30 }))).toBe(true);
    expect(isTimeSet(set(20, 5))).toBe(false);
    expect(isTimeSet(set(0, 0, { durationSeconds: 0 }))).toBe(false);
    expect(isTimeSet(set(0, 0, { durationSeconds: -5 }))).toBe(false);
    expect(isTimeSet(set(0, 0, { durationSeconds: Number.NaN }))).toBe(false);
  });

  it('a done working time set counts with reps 0; warm-up, undone and negative-kg ones do not', () => {
    expect(isDoneWorkingSet(set(20, 0, { durationSeconds: 45 }))).toBe(true);
    expect(isDoneWorkingSet(set(0, 0, { durationSeconds: 45, type: 'failure' }))).toBe(true);
    // unchanged: reps 0 without a duration is not a done working set
    expect(isDoneWorkingSet(set(20, 0))).toBe(false);
    expect(isDoneWorkingSet(set(20, 0, { durationSeconds: 45, type: 'warmup' }))).toBe(false);
    expect(isDoneWorkingSet(set(20, 0, { durationSeconds: 45, done: false }))).toBe(false);
    expect(isDoneWorkingSet(set(-1, 0, { durationSeconds: 45 }))).toBe(false);
  });
});

describe('time sets count as sets for load', () => {
  it('recovery: 2 time sets on a Core 100 exercise → load 2', () => {
    const r = recoveryStatus([plankLog(5)], lookupWithPlank, NOW);
    // 2 done time sets × 100/100 = 2 → recovering (0 < 2 < 6)
    expect(r.muscles).toEqual([
      { muscle: 'Core', status: 'recovering', lastTrainedAt: '2026-09-20T05:00:00.000Z', hoursSince: 5, load48h: 2 },
    ]);
  });

  it('ACWR: the same 2 time sets are acute and chronic load', () => {
    const [core] = acwr([plankLog(5)], lookupWithPlank, NOW);
    // acute = 2 × 1.0 = 2; history 5 h → weeks = floor(0) + 1 = 1 → chronic 2 / 1 = 2; ratio 2 / 2 = 1
    expect(core).toEqual({ muscle: 'Core', acuteLoad: 2, chronicLoad: 2, ratio: 1, status: 'recovering', trend: 'rising' });
  });

  it('impact distribution and lagging muscle see time sets', () => {
    const curlLog = logEndingAt(NOW, 24, [{ exerciseId: 'curl', sets: sets(2) }]);
    const dist = impactDistribution([plankLog(5), curlLog], lookupWithPlank);
    // Core 2 × 1.0 = 2, Biceps 2 × 1.0 = 2 → total 4 → 2/4 = 0.5 each
    expect(dist).toEqual({ Core: 0.5, Biceps: 0.5 });
    const onlyPlank = impactDistribution([plankLog(5)], lookupWithPlank);
    // one trained muscle → Core share 2/2 = 1
    expect(onlyPlank).toEqual({ Core: 1 });
    // trained, so not null: Chest .12 − 0 = .12 ties Quads .12, Chest comes first
    expect(laggingMuscle(onlyPlank)).toEqual({ muscle: 'Chest', actualShare: 0, targetShare: 0.12, gap: 0.12 });
  });
});

describe('time sets never produce PRs', () => {
  it('no e1rm, weight or reps candidate from a time set', () => {
    // 100 kg with seconds also typed as reps: would be a weight baseline of 100 without the time-set rule
    expect(detectPRs([exercise('hold', [set(100, 36, { durationSeconds: 36 })])], {})).toEqual([]);
    // 100 kg × 0 reps × 36 s → nothing
    expect(detectPRs([exercise('hold', [set(100, 0, { durationSeconds: 36 })])], {})).toEqual([]);
    // 0 kg × 5 reps × 30 s → no bodyweight reps PR
    expect(detectPRs([exercise('hold', [set(0, 5, { durationSeconds: 30 })])], { hold: { reps: 1 } })).toEqual([]);
  });

  it('a reps set next to a time set still gives its PRs', () => {
    const prs = detectPRs([exercise('press', [set(100, 5, { durationSeconds: 30 }), set(60, 10)])], { press: { e1rm: 70, weight: 50 } });
    // only 60×10: e1rm 60×36/27 = 80 > 70; weight 60 > 50
    expect(prs.map((p) => [p.prType, p.value, p.kg])).toEqual([
      ['e1rm', 80, 60],
      ['weight', 60, 60],
    ]);
  });
});

describe('holdSeconds / logHoldSeconds', () => {
  it('sums done non-warm-up time sets only', () => {
    const list = [
      set(20, 0, { durationSeconds: 45 }),
      set(20, 0, { durationSeconds: 30 }),
      set(20, 0, { durationSeconds: 60, type: 'warmup' }),
      set(20, 0, { durationSeconds: 20, done: false }),
      set(50, 10),
    ];
    // 45 + 30 = 75 (warm-up 60, undone 20 and the reps-only set excluded)
    expect(holdSeconds(list)).toBe(75);
    expect(holdSeconds([])).toBe(0);
    // a non-finite duration is ignored: only 45
    expect(holdSeconds([set(0, 0, { durationSeconds: Number.POSITIVE_INFINITY }), set(0, 0, { durationSeconds: 45 })])).toBe(45);
  });

  it('sums every exercise of a log', () => {
    const log = withDurations(
      logEndingAt(NOW, 2, [
        { exerciseId: 'plank', sets: [{ kg: 0, reps: 0 }, { kg: 0, reps: 0 }] },
        { exerciseId: 'press', sets: [{ kg: 60, reps: 10 }] },
        { exerciseId: 'carry', sets: [{ kg: 24, reps: 0 }] },
      ]),
      [45, 30, undefined, 40],
    );
    // plank 45 + 30 = 75; press 0; carry 40 → 115
    expect(logHoldSeconds(log)).toBe(115);
  });
});

describe('rankableE1rm', () => {
  const base = { type: 'working' as const, done: true };
  it.each([
    // 100×36/(37−5) = 3600/32 = 112.5
    ['100×5', { ...base, kg: 100, reps: 5 }, 112.5],
    // 100×36/(37−12) = 3600/25 = 144
    ['100×12', { ...base, kg: 100, reps: 12 }, 144],
    // 13 > E1RM_MAX_REPS 12
    ['100×13', { ...base, kg: 100, reps: 13 }, undefined],
    // kg ≤ 0
    ['0 kg', { ...base, kg: 0, reps: 5 }, undefined],
    // reps ≤ 0
    ['0 reps', { ...base, kg: 100, reps: 0 }, undefined],
    // durationSeconds 30 > 0 → time set
    ['time set', { ...base, kg: 100, reps: 5, durationSeconds: 30 }, undefined],
    ['warm-up', { ...base, kg: 100, reps: 5, type: 'warmup' as const }, undefined],
    ['not done', { ...base, kg: 100, reps: 5, done: false }, undefined],
    // 1 rep → e1rm = kg = 100
    ['100×1', { ...base, kg: 100, reps: 1 }, 100],
    // 20×36/27 = 26.666… → 26.67
    ['20×10 rounds to 0.01', { ...base, kg: 20, reps: 10 }, 26.67],
    // drop sets rank: 80×36/25 = 115.2
    ['drop 80×12', { ...base, kg: 80, reps: 12, type: 'drop' as const }, 115.2],
  ])('%s', (_label, input, expected) => {
    expect(rankableE1rm(input)).toBe(expected);
  });
});

describe('prefill of a time exercise', () => {
  it('keeps kg progression and ghostKg; seconds never become ghostReps', () => {
    const log = withDurations(
      logEndingAt(NOW, 24, [{ exerciseId: 'plank', sets: [{ kg: 20, reps: 0, rir: 3 }, { kg: 20, reps: 0, rir: 4 }] }]),
      [45, 40],
    );
    const r = prefillFromHistory('plank', [log]);
    // min RIR = min(3, 4) = 3 → +2.5: 20 + 2.5 = 22.5
    expect(r.basis).toBe('rir3plus');
    expect(r.suggestedKg).toBe(22.5);
    expect(r.sourceLogId).toBe(log.id);
    // 2 done time sets last time → 2 sets
    expect(r.sets.map((s) => s.kg)).toEqual([22.5, 22.5]);
    expect(r.sets.map((s) => s.ghostKg)).toEqual([20, 20]);
    expect(r.sets.map((s) => s.ghostReps)).toEqual([undefined, undefined]);
    expect(r.sets.every((s) => s.reps === 0 && !s.done && s.durationSeconds === undefined)).toBe(true);
  });

  it('ghostReps per set: none from a time set, as today from a reps set', () => {
    const log = withDurations(
      logEndingAt(NOW, 24, [{ exerciseId: 'plank', sets: [{ kg: 20, reps: 0, rir: 2 }, { kg: 20, reps: 10, rir: 3 }] }]),
      [45, undefined],
    );
    const r = prefillFromHistory('plank', [log]);
    // min RIR = min(2, 3) = 2 → +1.25: 20 + 1.25 = 21.25
    expect(r.sets.map((s) => [s.kg, s.ghostKg, s.ghostReps])).toEqual([
      [21.25, 20, undefined],
      [21.25, 20, 10],
    ]);
  });
});
