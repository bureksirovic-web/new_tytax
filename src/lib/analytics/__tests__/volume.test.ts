import { describe, it, expect } from 'vitest';
import { computeWeeklyVolume, computeMonthlyTrend, volumeByMuscle } from '../volume';
import { makeLog, volumeLog } from './fixtures';

describe('computeWeeklyVolume', () => {
  it('returns [] for empty logs', () => {
    expect(computeWeeklyVolume([])).toEqual([]);
  });

  it('groups logs by local ISO week', () => {
    const logs = [
      volumeLog('2024-01-01', 1000), // Monday, 2024-W01
      volumeLog('2024-01-03', 1500), // Wednesday, 2024-W01
      volumeLog('2024-01-10', 2000), // next Wednesday, 2024-W02
    ];
    const result = computeWeeklyVolume(logs);
    expect(result.map((p) => p.weekKey)).toEqual(['2024-W01', '2024-W02']);
    // week 1: 1000 + 1500 = 2500 over 2 sessions
    expect(result[0].totalVolume).toBe(2500);
    expect(result[0].sessionCount).toBe(2);
    // week 2: 2000 over 1 session
    expect(result[1].totalVolume).toBe(2000);
    expect(result[1].sessionCount).toBe(1);
  });

  it('a Sunday stays in its own week whatever the timezone', () => {
    // 2024-01-07 is the Sunday closing 2024-W01 (parsed as a local day, not UTC)
    expect(computeWeeklyVolume([volumeLog('2024-01-07', 10)])[0].weekKey).toBe('2024-W01');
  });

  it('calculates modalities and standardised muscles', () => {
    const result = computeWeeklyVolume([volumeLog('2024-01-01', 1000, 'CHEST')]);
    // 1000 × 1 rep = 1000 on tytax; CHEST → Chest at score 100 → 1000
    expect(result[0].byModality['tytax']).toBe(1000);
    expect(result[0].byMuscle['Chest']).toBe(1000);
  });

  it('counts only done working sets and skips soft-deleted logs', () => {
    const logs = [
      makeLog('2024-01-01', [
        {
          id: 'x',
          sets: [{ kg: 100, reps: 5 }, { kg: 50, reps: 3, type: 'drop' }, { kg: 40, reps: 10, type: 'warmup' }, { kg: 120, reps: 5, done: false }],
          impact: [{ muscle: 'Quads (stability)', score: 50 }],
        },
      ]),
      makeLog('2024-01-02', [{ id: 'x', sets: [{ kg: 999, reps: 1 }] }], { deletedAt: '2024-01-02T12:00:00.000Z' }),
    ];
    const [week] = computeWeeklyVolume(logs);
    // 100×5 + 50×3 (drop counts) = 650; warm-up, undone and deleted excluded
    expect(week.totalVolume).toBe(650);
    expect(week.sessionCount).toBe(1);
    // Quads (stability) → Quads at 50 % → 325
    expect(week.byMuscle).toEqual({ Quads: 325 });
  });
});

describe('volumeByMuscle', () => {
  it('sums impact-weighted volume per standardised muscle, largest first', () => {
    const logs = [
      makeLog('2024-01-01', [
        { id: 'a', sets: [{ kg: 100, reps: 10 }], impact: [{ muscle: 'Chest', score: 100 }, { muscle: 'Triceps', score: 50 }] },
        { id: 'b', sets: [{ kg: 20, reps: 10 }], impact: [{ muscle: 'triceps', score: 100 }] },
      ]),
    ];
    const r = volumeByMuscle(logs);
    // Chest 1000×1 = 1000; Triceps 1000×.5 + 200×1 = 700
    expect(r).toEqual({ Chest: 1000, Triceps: 700 });
    expect(Object.keys(r)).toEqual(['Chest', 'Triceps']);
  });
});

describe('computeMonthlyTrend', () => {
  it('groups by YYYY-MM', () => {
    const logs = [volumeLog('2024-01-15', 1000), volumeLog('2024-01-20', 1500), volumeLog('2024-02-10', 2000)];
    const result = computeMonthlyTrend(logs);
    expect(result).toHaveLength(2);
    expect(result[0].month).toBe('2024-01');
    // 1000 + 1500 = 2500
    expect(result[0].volume).toBe(2500);
    expect(result[1].month).toBe('2024-02');
    // 2000
    expect(result[1].volume).toBe(2000);
  });
});
