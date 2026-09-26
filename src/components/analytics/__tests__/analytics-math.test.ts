import { describe, expect, it } from 'vitest';
import { daysBetween, localDay, mondayOf, shiftDay } from '../analytics-dates';
import { acwrSummary, acwrZone, heatLevel, heatmapWeeks, muscleDistribution, weeklyVolume } from '../analytics-math';
import { exercise, logsAt, lookupOf } from './helpers';

// Saturday 2026-09-26, 18:00 local. Monday of that week: 2026-09-21.
const NOW = new Date(2026, 8, 26, 18, 0);
const lookup = lookupOf([
  exercise('bench', [{ muscle: 'Chest', score: 100 }, { muscle: 'Triceps', score: 50 }, { muscle: 'Front Delts', score: 50 }]),
  exercise('squat', [{ muscle: 'Quads', score: 100 }, { muscle: 'Glutes', score: 50 }], 'squat'),
]);
const bench2 = { exerciseId: 'bench', sets: [{ kg: 100, reps: 5 }, { kg: 100, reps: 5 }, { kg: 50, reps: 10, type: 'warmup' as const }] };
const squat2 = { exerciseId: 'squat', sets: [{ kg: 80, reps: 5 }, { kg: 80, reps: 5 }] };

describe('analytics dates', () => {
  it('works on local calendar days', () => {
    expect(localDay(NOW)).toBe('2026-09-26');
    expect(mondayOf('2026-09-26')).toBe('2026-09-21');
    expect(mondayOf('2026-09-21')).toBe('2026-09-21');
    expect(mondayOf('2026-09-27')).toBe('2026-09-21'); // Sunday belongs to the week that started Monday
    // across the 2026-10-25 DST change: calendar arithmetic, not 24 h steps
    expect(shiftDay('2026-10-24', 2)).toBe('2026-10-26');
    expect(daysBetween('2026-10-24', '2026-10-26')).toBe(2);
    expect(shiftDay('2026-03-01', -1)).toBe('2026-02-28');
  });
});

describe('muscleDistribution', () => {
  const logs = logsAt(NOW, [
    { daysAgo: 2, exercises: [bench2] },
    { daysAgo: 10, exercises: [squat2] },
    { daysAgo: 3, deleted: true, exercises: [squat2] },
  ]);

  it('7 days: only the bench log; warm-ups and deleted logs never count', () => {
    const { shares, lagging } = muscleDistribution(logs, lookup, '7d', NOW);
    // 2 working sets × (Chest 1, Triceps .5, Front Delts .5) = 2 / 1 / 1 of 4
    // kg volume: 2 × 100 kg × 5 = 1000 kg (warm-up excluded) → Chest 1000, Front Delts 500, Triceps 500
    expect(shares).toEqual([
      { muscle: 'Chest', share: 0.5, volumeKg: 1000 },
      { muscle: 'Front Delts', share: 0.25, volumeKg: 500 },
      { muscle: 'Triceps', share: 0.25, volumeKg: 500 },
    ]);
    // Quads has target .12 and actual 0: the largest positive gap
    expect(lagging).toMatchObject({ muscle: 'Quads', actualShare: 0, targetShare: 0.12 });
    expect(lagging!.gap).toBeCloseTo(0.12, 6);
  });

  it('30 days adds the squat log', () => {
    const { shares } = muscleDistribution(logs, lookup, '30d', NOW);
    // Chest 2, Quads 2, Glutes 1, Triceps 1, Front Delts 1 → total 7
    expect(shares.map((s) => s.muscle)).toEqual(['Chest', 'Quads', 'Front Delts', 'Glutes', 'Triceps']);
    expect(shares[0].share).toBeCloseTo(2 / 7, 6);
  });

  it('last 20 sessions ignores older sessions', () => {
    const many = logsAt(
      NOW,
      Array.from({ length: 25 }, (_, i) => ({ daysAgo: i + 1, exercises: [i < 20 ? bench2 : squat2] })),
    );
    const { shares } = muscleDistribution(many, lookup, '20s', NOW);
    expect(shares.map((s) => s.muscle)).not.toContain('Quads');
    expect(muscleDistribution(many, lookup, '30d', NOW).shares.map((s) => s.muscle)).toContain('Quads');
  });

  it('no logs → no shares and no lagging muscle', () => {
    expect(muscleDistribution([], lookup, '7d', NOW)).toEqual({ shares: [], lagging: null });
  });
});

describe('ACWR', () => {
  it('maps ratios to zones', () => {
    expect(acwrZone(0.79)).toBe('undertrain');
    expect(acwrZone(0.8)).toBe('optimal');
    expect(acwrZone(1.3)).toBe('optimal');
    expect(acwrZone(1.31)).toBe('caution');
    expect(acwrZone(1.5)).toBe('caution');
    expect(acwrZone(1.51)).toBe('danger');
  });

  it('a 10-day-old history is still building its baseline (no fake danger)', () => {
    const logs = logsAt(NOW, [{ daysAgo: 2, exercises: [bench2] }, { daysAgo: 10, exercises: [bench2] }]);
    const s = acwrSummary(logs, lookup, NOW);
    expect(s.daysOfHistory).toBe(10);
    expect(s.building).toBe(true);
    expect(s.rows.find((r) => r.muscle === 'Chest')?.acute).toBe(2);
  });

  it('with 28+ days of history, ratios and zones are real', () => {
    const logs = logsAt(NOW, [
      { daysAgo: 2, exercises: [bench2] },
      { daysAgo: 10, exercises: [bench2] },
      { daysAgo: 40, exercises: [bench2] },
    ]);
    const s = acwrSummary(logs, lookup, NOW);
    expect(s.building).toBe(false);
    // Chest: acute (7 d) = 2 sets; chronic = (2 + 2) / 4 weeks = 1 → ratio 2 → danger
    expect(s.rows.find((r) => r.muscle === 'Chest')).toEqual({ muscle: 'Chest', acute: 2, chronic: 1, ratio: 2, zone: 'danger' });
  });

  it('no logs → no rows, zero history', () => {
    expect(acwrSummary([], lookup, NOW)).toEqual({ rows: [], daysOfHistory: 0, building: true });
  });
});

describe('heatmap and weekly volume', () => {
  const logs = logsAt(NOW, [
    { daysAgo: 2, exercises: [bench2] },
    { daysAgo: 10, exercises: [squat2] },
    { daysAgo: 3, deleted: true, exercises: [bench2] },
    { daysAgo: 100, exercises: [bench2] },
  ]);

  it('12 Monday-first weeks ending this week, deleted logs excluded', () => {
    const grid = heatmapWeeks(logs, NOW, 12);
    expect(grid).toHaveLength(12);
    expect(grid.every((w) => w.length === 7)).toBe(true);
    expect(grid[0][0].day).toBe('2026-07-06'); // 2026-09-21 − 11 weeks
    expect(grid[11][6]).toMatchObject({ day: '2026-09-27', future: true });
    const days = grid.flat();
    expect(days.filter((d) => d.sessions > 0).map((d) => d.day)).toEqual(['2026-09-16', '2026-09-24']);
    // 2 × 100 × 5 = 1000 kg; the 50 × 10 warm-up is not volume
    expect(days.find((d) => d.day === '2026-09-24')?.volumeKg).toBe(1000);
  });

  it('heat levels are quartiles of the busiest day', () => {
    expect(heatLevel(0, 0, 1000)).toBe(0);
    expect(heatLevel(1000, 1, 1000)).toBe(4);
    expect(heatLevel(250, 1, 1000)).toBe(1);
    expect(heatLevel(260, 1, 1000)).toBe(2);
    expect(heatLevel(0, 1, 0)).toBe(1); // trained, but a bodyweight-only day
  });

  it('weekly volume has 8 weeks with empty weeks as 0 and excludes warm-ups', () => {
    const weeks = weeklyVolume(logs, NOW, 8);
    expect(weeks).toHaveLength(8);
    expect(weeks[7]).toEqual({ weekStart: '2026-09-21', volumeKg: 1000 });
    // squat 2 × 80 × 5 = 800 in the week of 2026-09-14
    expect(weeks[6]).toEqual({ weekStart: '2026-09-14', volumeKg: 800 });
    expect(weeks.slice(0, 6).every((w) => w.volumeKg === 0)).toBe(true);
  });
});
