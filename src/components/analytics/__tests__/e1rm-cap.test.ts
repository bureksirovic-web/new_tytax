/**
 * G4-41: analytics ranks e1RM only through G1's `rankableE1rm` (cap
 * `E1RM_MAX_REPS`). The rule itself is tested by G1 in `@/lib/training`;
 * this checks the analytics derivations apply it.
 */
import { describe, expect, it } from 'vitest';
import { training } from '@/lib/training';
import { bestLifts, exerciseSeries, pinnedSummary } from '../exercise-series';
import { logsAt } from './helpers';

const NOW = new Date(2026, 8, 26, 18, 0);

describe('e1RM rep cap in analytics (G4-41)', () => {
  it('24 kg × 35 reps would read as a 432 kg lift without the cap', () => {
    expect(training.e1rm(24, 35)).toBe(432);
    const logs = logsAt(NOW, [{ daysAgo: 1, exercises: [{ exerciseId: 'swing', sets: [{ kg: 24, reps: 35 }] }] }]);
    expect(bestLifts(logs)).toEqual([]);
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
