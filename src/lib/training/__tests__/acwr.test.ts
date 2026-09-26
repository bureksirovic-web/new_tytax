import { describe, expect, it } from 'vitest';
import type { SeedExerciseInput } from '@/contracts/fixtures';
import { acwr, historyWeeks, training } from '../index';
import { DAY, logEndingAt, lookup, sets } from './helpers';

const NOW = new Date('2026-09-28T12:00:00Z');

/** A log `days` days ago with `n` done working curl sets (Biceps 1.0 each). */
function curls(days: number, n: number, extra: SeedExerciseInput['sets'] = []) {
  return logEndingAt(NOW, days * 24, [{ exerciseId: 'curl', sets: [...sets(n), ...extra] }]);
}

function biceps(logs: Parameters<typeof acwr>[0]) {
  return acwr(logs, lookup, NOW).find((r) => r.muscle === 'Biceps');
}

describe('acwr', () => {
  it('steady load → ratio 1, recovering, stable', () => {
    const r = biceps([curls(2, 4), curls(10, 4), curls(17, 4), curls(24, 4)]);
    // history 24 d → floor(24/7)+1 = 4 weeks; acute (last 7 d) = 4; chronic = (4+4+4+4)/4 = 4; ratio 4/4 = 1;
    // previous week (7–14 d) = 4 → stable
    expect(r).toEqual({ muscle: 'Biceps', acuteLoad: 4, chronicLoad: 4, ratio: 1, status: 'recovering', trend: 'stable' });
  });

  it('spike → fried and rising', () => {
    const r = biceps([curls(1, 12), curls(10, 4), curls(17, 4), curls(24, 4)]);
    // history 24 d → 4 weeks; acute 12; chronic (12+4+4+4)/4 = 6; ratio 12/6 = 2 > 1.5 → fried; 12 > 4×1.1 → rising
    expect(r).toMatchObject({ acuteLoad: 12, chronicLoad: 6, ratio: 2, status: 'fried', trend: 'rising' });
  });

  it('under-load → fresh and falling', () => {
    const r = biceps([curls(3, 1), curls(10, 5), curls(17, 5), curls(24, 5)]);
    // history 24 d → 4 weeks; acute 1; chronic (1+5+5+5)/4 = 4; ratio 1/4 = 0.25 < 0.8 → fresh; 1 < 5×0.9 → falling
    expect(r).toMatchObject({ acuteLoad: 1, chronicLoad: 4, ratio: 0.25, status: 'fresh', trend: 'falling' });
  });

  it('thresholds are strict: 1.5 and 0.8 are still recovering', () => {
    // A press log 22 d ago gives 4 weeks of history (floor(22/7)+1 = 3+1 = 4) without adding Biceps load.
    const history = logEndingAt(NOW, 22 * 24, [{ exerciseId: 'press', sets: sets(1) }]);
    const at15 = biceps([curls(1, 6), curls(20, 10), history]);
    // acute 6; chronic (6+10)/4 = 4; ratio 6/4 = 1.5 → not > 1.5 → recovering; previous week 0, acute > 0 → rising
    expect(at15).toMatchObject({ ratio: 1.5, status: 'recovering', trend: 'rising' });
    const at08 = biceps([curls(1, 4), curls(10, 16), history]);
    // acute 4; chronic (4+16)/4 = 5; ratio 4/5 = 0.8 → not < 0.8 → recovering; 4 < 16×0.9 → falling
    expect(at08).toMatchObject({ ratio: 0.8, status: 'recovering', trend: 'falling' });
  });

  it('a short history divides the chronic load by the weeks actually trained (cold start)', () => {
    // earliest log 10 d ago → floor(10/7)+1 = 2 weeks; acute 4; chronic (4+4)/2 = 4; ratio 1 → recovering
    expect(biceps([curls(2, 4), curls(10, 4)])).toMatchObject({ chronicLoad: 4, ratio: 1, status: 'recovering' });
    // one session 1 d ago → floor(1/7)+1 = 1 week; chronic = acute = 3; ratio 1 (not 4 → fried)
    expect(biceps([curls(1, 3)])).toMatchObject({ acuteLoad: 3, chronicLoad: 3, ratio: 1, status: 'recovering' });
    // a 6-week-old log: floor(42/7)+1 = 7, clamped to 4 weeks; chronic = 8/4 = 2 from the in-window log only;
    // ratio 8/2 = 4 → fried
    expect(biceps([curls(1, 8), curls(42, 8)])).toMatchObject({ chronicLoad: 2, ratio: 4, status: 'fried' });
  });

  it('a log exactly 7 d ago means two weeks of history', () => {
    // earliest 7 d → floor(7/7)+1 = 2 weeks; acute (7 d, 0] = 4 (the 7 d log is not acute);
    // chronic (4+4)/2 = 4; ratio 4/4 = 1 → recovering; previous week (14 d, 7 d] = 4 → stable
    expect(biceps([curls(1, 4), curls(7, 4)])).toEqual({
      muscle: 'Biceps',
      acuteLoad: 4,
      chronicLoad: 4,
      ratio: 1,
      status: 'recovering',
      trend: 'stable',
    });
  });

  it('an older log without load does not extend history', () => {
    const warmOnly = logEndingAt(NOW, 20 * 24, [{ exerciseId: 'curl', sets: [{ kg: 10, reps: 10, type: 'warmup' }, { kg: 30, reps: 5, done: false }] }]);
    const noImpact = logEndingAt(NOW, 25 * 24, [{ exerciseId: 'mystery', sets: sets(3) }]);
    const empty = logEndingAt(NOW, 15 * 24, []);
    // no done working set with impact 15, 20 or 25 d ago → history from the 1 d log: 1 week;
    // chronic = acute = 3; ratio 1 → recovering (counting those logs would give 3 or 4 weeks → ratio 3 or 4 → fried)
    expect(biceps([curls(1, 3), warmOnly, noImpact, empty])).toMatchObject({ acuteLoad: 3, chronicLoad: 3, ratio: 1, status: 'recovering' });
  });

  it('historyWeeks = min(4, floor(age / 7 d) + 1)', () => {
    const t = NOW.getTime();
    // 1 d → floor(1/7)+1 = 1; 6.99 d → 0+1 = 1; 7 d → 1+1 = 2; 10 d → 1+1 = 2; 14 d → 2+1 = 3; 22 d → 3+1 = 4; 60 d → 9 → 4
    expect([1, 6.99, 7, 10, 14, 22, 60].map((d) => historyWeeks(t, t - d * DAY))).toEqual([1, 1, 2, 2, 3, 4, 4]);
    // no load-bearing log (Infinity) or one in the future → 1
    expect(historyWeeks(t, Infinity)).toBe(1);
    expect(historyWeeks(t, t + DAY)).toBe(1);
  });

  it('window edges: exactly 7 d is not acute, exactly 28 d is out', () => {
    const r = biceps([curls(7, 3), curls(28, 100), curls(27.9, 1)]);
    // history 28 d → floor(28/7)+1 = 5, clamped to 4 weeks; acute (7 d, 0] = 0;
    // chronic (3 + 1)/4 = 1 (the 28 d log is excluded); ratio 0/1 = 0 → fresh
    // previous week (14 d, 7 d] = 3 → acute 0 < 3×0.9 → falling
    expect(r).toMatchObject({ acuteLoad: 0, chronicLoad: 1, ratio: 0, status: 'fresh', trend: 'falling' });
    expect(biceps([curls(30, 5)])).toBeUndefined();
  });

  it('only done working sets of live logs count', () => {
    const warm = [{ kg: 10, reps: 10, type: 'warmup' as const }, { kg: 30, reps: 5, done: false }];
    const deleted = logEndingAt(NOW, 24, [{ exerciseId: 'curl', sets: sets(20) }], { deleted: true });
    const r = biceps([curls(2, 4, warm), curls(10, 4, warm), deleted]);
    // acute 4 (warm-up, undone and deleted excluded); history = floor(10/7)+1 = 2 weeks (the deleted log does not count);
    // chronic (4+4)/2 = 4; ratio 4/4 = 1 → recovering; previous week 4 → stable
    expect(r).toMatchObject({ acuteLoad: 4, chronicLoad: 4, ratio: 1, status: 'recovering', trend: 'stable' });
  });

  it('one row per standardised muscle, sorted by acute load', () => {
    const log = logEndingAt(NOW, 24, [{ exerciseId: 'press', sets: sets(2) }]);
    const rows = training.acwr([log], lookup, NOW);
    // Chest 2×1 = 2, Triceps 2×0.5 = 1; one session 1 d ago → floor(1/7)+1 = 1 week → chronic = acute → ratio 1
    expect(rows.map((r) => [r.muscle, r.acuteLoad, r.chronicLoad, r.ratio])).toEqual([
      ['Chest', 2, 2, 1],
      ['Triceps', 1, 1, 1],
    ]);
    expect(acwr([], lookup, NOW)).toEqual([]);
  });
});
