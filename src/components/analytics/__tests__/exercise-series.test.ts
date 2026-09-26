import { describe, expect, it } from 'vitest';
import { bestLifts, exerciseSeries, movementParity, patternOf, pinnedSummary, trainedExercises } from '../exercise-series';
import { parseBodyweight, pluralForm } from '../labels';
import { exercise, logsAt, lookupOf } from './helpers';

const NOW = new Date(2026, 8, 26, 18, 0);
const logs = logsAt(NOW, [
  {
    daysAgo: 10,
    exercises: [
      {
        exerciseId: 'bench',
        sets: [
          { kg: 100, reps: 5 },
          { kg: 90, reps: 8 },
          { kg: 120, reps: 1, type: 'warmup' },
          { kg: 130, reps: 3, done: false },
        ],
      },
      { exerciseId: 'squat', sets: [{ kg: 60, reps: 5, type: 'warmup' }] },
    ],
  },
  { daysAgo: 2, exercises: [{ exerciseId: 'bench', sets: [{ kg: 105, reps: 5 }] }] },
  { daysAgo: 1, deleted: true, exercises: [{ exerciseId: 'bench', sets: [{ kg: 200, reps: 5 }] }] },
]);

describe('exerciseSeries', () => {
  it('one point per session, oldest first, over done working sets only', () => {
    const pts = exerciseSeries(logs, 'bench');
    expect(pts.map((p) => p.date)).toEqual(['2026-09-16', '2026-09-24']);
    // 100×5 → 100×36/32 = 112.5 beats 90×8 → 90×36/29 = 111.72; the 120 warm-up and undone 130 never count
    expect(pts[0]).toMatchObject({ e1rm: 112.5, topKg: 100, bestKg: 100, bestReps: 5 });
    // volume 100×5 + 90×8 = 1220
    expect(pts[0].volumeKg).toBe(1220);
    // 105×5 → 105×36/32 = 118.125
    expect(pts[1]).toMatchObject({ e1rm: 118.125, topKg: 105, volumeKg: 525 });
  });

  it('pinned summary: best, latest and change vs the previous session', () => {
    const s = pinnedSummary(logs, 'bench');
    expect(s.best).toBe(118.125);
    expect(s.latest).toBe(118.125);
    expect(s.delta).toBeCloseTo(5.625, 6); // 118.125 − 112.5
    expect(pinnedSummary(logs, 'nothing')).toMatchObject({ best: null, latest: null, delta: null, points: [] });
  });

  it('trained exercises skip exercises with only warm-ups; best lifts ignore deleted logs', () => {
    expect(trainedExercises(logs, (id) => id.toUpperCase())).toEqual([{ id: 'bench', name: 'BENCH' }]);
    expect(bestLifts(logs)).toEqual([{ exerciseId: 'bench', e1rm: 118.125, kg: 105, reps: 5, date: '2026-09-24' }]);
  });
});

describe('movementParity', () => {
  it('shares volume by movement pattern against targets', () => {
    const lookup = lookupOf([exercise('bench', [], 'Horizontal Push'), exercise('squat', [], 'Squat')]);
    expect(patternOf('bench', lookup)).toBe('push');
    expect(patternOf('unknown', lookup)).toBe('other');
    const withSquat = [...logs, ...logsAt(NOW, [{ daysAgo: 3, exercises: [{ exerciseId: 'squat', sets: [{ kg: 100, reps: 10 }] }] }])];
    const rows = movementParity(withSquat, lookup, '2026-08-28');
    // push 1220 + 525 = 1745, quad 1000 → total 2745
    const push = rows.find((r) => r.pattern === 'push')!;
    expect(push.pct).toBeCloseTo((1745 / 2745) * 100, 6);
    expect(push.onTarget).toBe(false);
    expect(rows.find((r) => r.pattern === 'quad')!.pct).toBeCloseTo((1000 / 2745) * 100, 6);
    expect(movementParity([], lookup, '2026-08-28')).toEqual([]);
  });
});

describe('parseBodyweight', () => {
  it('accepts 20–400 kg, comma or dot decimals', () => {
    expect(parseBodyweight('80', 'kg')).toEqual({ ok: true, kg: 80 });
    expect(parseBodyweight(' 80,5 ', 'kg')).toEqual({ ok: true, kg: 80.5 });
    expect(parseBodyweight('400', 'kg')).toEqual({ ok: true, kg: 400 });
    for (const bad of ['0', '500', 'abc', '', '19.9', '400.1', '-80', '8e1']) expect(parseBodyweight(bad, 'kg')).toEqual({ ok: false });
  });

  it('converts pounds to kg before checking the range', () => {
    // 176.4 lb / 2.20462 = 80.0138… → 80.01 kg
    expect(parseBodyweight('176.4', 'lb')).toEqual({ ok: true, kg: 80.01 });
    // 44 lb = 19.96 kg < 20 → rejected; 900 lb = 408.2 kg > 400 → rejected
    expect(parseBodyweight('44', 'lb')).toEqual({ ok: false });
    expect(parseBodyweight('900', 'lb')).toEqual({ ok: false });
  });
});

describe('pluralForm', () => {
  it('Croatian has 1 / 2–4 / 5+ forms with the 11–14 exception', () => {
    expect([1, 2, 4, 5, 11, 12, 14, 21, 22, 25, 111].map((n) => pluralForm(n, 'hr'))).toEqual([
      'one', 'few', 'few', 'many', 'many', 'many', 'many', 'one', 'few', 'many', 'many',
    ]);
    expect([1, 2, 5].map((n) => pluralForm(n, 'en'))).toEqual(['one', 'many', 'many']);
  });
});
