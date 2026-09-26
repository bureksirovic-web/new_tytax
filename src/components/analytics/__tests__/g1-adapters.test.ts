/**
 * G1 Wave 2 adapters (G4-41): the fallback path (module without the export)
 * and the G1-present path (module object passed in), plus parity of the
 * local copies with whatever `@/lib/training` really exports. On v2-g4 the
 * real module has no `rankableE1rm`, so the parity block checks the fallback;
 * on the integration tree (G1 merged) it checks the local copy against G1.
 */
import { describe, expect, it, vi } from 'vitest';
import type { SetEntry } from '@/contracts/domain';
import * as trainingModule from '@/lib/training';
import { training } from '@/lib/training';
import { bestLifts, exerciseSeries, pinnedSummary } from '../exercise-series';
import {
  e1rmMaxReps,
  FALLBACK_E1RM_MAX_REPS,
  isTimeSetG1,
  localIsTimeSet,
  localRankableE1rm,
  rankableE1rmG1,
} from '../g1-adapters';
import { logsAt } from './helpers';

const set = (over: Partial<SetEntry>): SetEntry => ({ id: 's', type: 'working', kg: 100, reps: 5, done: true, ...over });
const NOW = new Date(2026, 8, 26, 18, 0);

describe('fallback (training module without the Wave 2 exports)', () => {
  const bare = {};
  it('caps e1RM at 12 reps and rounds to 0.01 kg', () => {
    expect(FALLBACK_E1RM_MAX_REPS).toBe(12);
    expect(e1rmMaxReps(bare)).toBe(12);
    expect(rankableE1rmG1(set({ kg: 105, reps: 5 }), bare)).toBe(118.13); // 105 × 36 / 32 = 118.125
    expect(rankableE1rmG1(set({ kg: 60, reps: 12 }), bare)).toBe(86.4); // 60 × 36 / 25
    expect(rankableE1rmG1(set({ kg: 24, reps: 13 }), bare)).toBeUndefined();
    // G4-41: 24 kg × 35 reps was ranked as a 432 kg "best lift".
    expect(training.e1rm(24, 35)).toBe(432);
    expect(rankableE1rmG1(set({ kg: 24, reps: 35 }), bare)).toBeUndefined();
  });

  it('never ranks warm-ups, undone sets, time sets or kg ≤ 0', () => {
    expect(rankableE1rmG1(set({ type: 'warmup' }), bare)).toBeUndefined();
    expect(rankableE1rmG1(set({ done: false }), bare)).toBeUndefined();
    expect(rankableE1rmG1(set({ durationSeconds: 30 }), bare)).toBeUndefined();
    expect(rankableE1rmG1(set({ kg: 0 }), bare)).toBeUndefined();
    expect(rankableE1rmG1(set({ reps: 0 }), bare)).toBeUndefined();
    expect(rankableE1rmG1(set({ type: 'drop', kg: 80, reps: 8 }), bare)).toBeCloseTo(99.31, 6);
  });

  it('a time set is one that carries a duration', () => {
    expect(isTimeSetG1(set({ durationSeconds: 45 }), bare)).toBe(true);
    expect(isTimeSetG1(set({ durationSeconds: 0 }), bare)).toBe(true);
    expect(isTimeSetG1(set({}), bare)).toBe(false);
  });

  it('honours a different exported cap with the local rule', () => {
    expect(rankableE1rmG1(set({ kg: 60, reps: 13 }), { E1RM_MAX_REPS: 13 })).toBe(90);
  });
});

describe('G1 present (exports on the module object)', () => {
  it('delegates to rankableE1rm / isTimeSet / E1RM_MAX_REPS', () => {
    const rankableE1rm = vi.fn((s: SetEntry) => (s.reps <= 3 ? 777 : undefined));
    const isTimeSet = vi.fn((s: SetEntry) => (s.durationSeconds ?? 0) > 0);
    const g1 = { rankableE1rm, isTimeSet, E1RM_MAX_REPS: 3 };
    expect(rankableE1rmG1(set({ reps: 3 }), g1)).toBe(777);
    expect(rankableE1rmG1(set({ reps: 5 }), g1)).toBeUndefined();
    expect(rankableE1rm).toHaveBeenCalledTimes(2);
    expect(isTimeSetG1(set({ durationSeconds: 0 }), g1)).toBe(false);
    expect(isTimeSetG1(set({ durationSeconds: 20 }), g1)).toBe(true);
    expect(e1rmMaxReps(g1)).toBe(3);
  });

  it('treats a non-positive or non-number result as not rankable', () => {
    expect(rankableE1rmG1(set({}), { rankableE1rm: () => 0 })).toBeUndefined();
    expect(rankableE1rmG1(set({}), { rankableE1rm: () => 'x' })).toBeUndefined();
  });
});

describe('parity with the real @/lib/training', () => {
  const real = trainingModule as unknown as Record<string, unknown>;
  const cases: SetEntry[] = [
    set({ kg: 100, reps: 5 }),
    set({ kg: 102.06, reps: 5 }),
    set({ kg: 60, reps: 12 }),
    set({ kg: 60, reps: 13 }),
    set({ kg: 24, reps: 35 }),
    set({ kg: 200, reps: 1 }),
    set({ kg: 0, reps: 10 }),
    set({ type: 'warmup' }),
    set({ type: 'failure', kg: 90, reps: 8 }),
    set({ done: false }),
    set({ kg: 20, reps: 1, durationSeconds: 60 }),
  ];

  it('the local copy matches G1 when G1 exports rankableE1rm (else the adapter is the local copy)', () => {
    const fn = real.rankableE1rm as ((s: SetEntry) => number | undefined) | undefined;
    for (const c of cases) {
      const expected = typeof fn === 'function' ? fn(c) : localRankableE1rm(c);
      expect(rankableE1rmG1(c), JSON.stringify(c)).toBe(expected);
      expect(localRankableE1rm(c, e1rmMaxReps()), JSON.stringify(c)).toBe(expected);
    }
    expect(e1rmMaxReps()).toBe(typeof real.E1RM_MAX_REPS === 'number' ? real.E1RM_MAX_REPS : 12);
  });

  it('isTimeSet agrees with the local rule except for a recorded 0 s (G1: > 0 only)', () => {
    const fn = real.isTimeSet as ((s: SetEntry) => boolean) | undefined;
    for (const d of [undefined, 1, 30, 600]) {
      const c = set({ durationSeconds: d });
      expect(isTimeSetG1(c)).toBe(localIsTimeSet(c));
    }
    expect(isTimeSetG1(set({ durationSeconds: 0 }))).toBe(typeof fn === 'function' ? false : true);
  });

  it('analytics never ranks a set above the cap: best lifts, series, pinned summary', () => {
    const logs = logsAt(NOW, [
      { daysAgo: 3, exercises: [{ exerciseId: 'swing', sets: [{ kg: 24, reps: 35 }] }, { exerciseId: 'bench', sets: [{ kg: 100, reps: 5 }] }] },
      { daysAgo: 1, exercises: [{ exerciseId: 'swing', sets: [{ kg: 32, reps: 20 }, { kg: 32, reps: 10 }] }] },
    ]);
    expect(bestLifts(logs).map((l) => [l.exerciseId, l.e1rm, l.reps])).toEqual([
      ['bench', 112.5, 5],
      ['swing', 42.67, 10], // 32 × 36 / 27 = 42.666…
    ]);
    const series = exerciseSeries(logs, 'swing');
    // The 35-rep session still has top set and volume, but no e1RM.
    expect(series.map((p) => [p.e1rm, p.topKg, p.volumeKg])).toEqual([
      [0, 24, 840],
      [42.67, 32, 960],
    ]);
    const summary = pinnedSummary(logs, 'swing');
    expect(summary.points).toHaveLength(1);
    expect(summary).toMatchObject({ best: 42.67, latest: 42.67, delta: null });
  });
});
