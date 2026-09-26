import { describe, it, expect } from 'vitest';
import { computeACWR, getACWRZone } from '../acwr';
import { makeLog, volumeLog } from './fixtures';

describe('computeACWR', () => {
  it('returns [] for empty logs', () => {
    expect(computeACWR([])).toEqual([]);
  });

  it('returns ratio of 1.0 for a single workout', () => {
    const result = computeACWR([volumeLog('2024-01-01', 1000)]);
    expect(result).toHaveLength(1);
    // single training day → ratio fixed at 1
    expect(result[0].ratio).toBe(1.0);
    // acute = 1000/7, chronic = 1000/28
    expect(result[0].acute).toBeCloseTo(1000 / 7, 10);
    expect(result[0].chronic).toBeCloseTo(1000 / 28, 10);
  });

  it('calculates higher ratio for high recent volume', () => {
    const logs = [
      volumeLog('2024-01-01', 1000),
      volumeLog('2024-01-08', 1000),
      volumeLog('2024-01-15', 1000),
      volumeLog('2024-01-22', 4000),
    ];
    const last = computeACWR(logs).at(-1);
    // acute = 4000/7; chronic (2023-12-26..2024-01-22) = 7000/28 = 250 → ratio (4000/7)/250 = 16/7 ≈ 2.2857
    expect(last?.ratio).toBeCloseTo(16 / 7, 10);
    expect(last?.zone).toBe('danger');
    // 2024-01-22 is a Monday: its week holds only that session → 4000
    expect(last?.weeklyVolume).toBe(4000);
  });

  it('counts only done working sets and skips soft-deleted logs', () => {
    const logs = [
      makeLog('2024-01-01', [
        { id: 'x', sets: [{ kg: 100, reps: 10 }, { kg: 40, reps: 10, type: 'warmup' }, { kg: 120, reps: 5, done: false }] },
      ]),
      makeLog('2024-01-02', [{ id: 'x', sets: [{ kg: 500, reps: 10 }] }], { deletedAt: '2024-01-03T00:00:00.000Z' }),
    ];
    const result = computeACWR(logs);
    // deleted log dropped → 1 row; volume = 100×10 = 1000 → acute 1000/7
    expect(result).toHaveLength(1);
    expect(result[0].acute).toBeCloseTo(1000 / 7, 10);
    // week of Mon 2024-01-01 → 1000
    expect(result[0].weeklyVolume).toBe(1000);
  });
});

describe('getACWRZone', () => {
  it('returns undertrain for < 0.8', () => {
    expect(getACWRZone(0.5)).toBe('undertrain');
    expect(getACWRZone(0.79)).toBe('undertrain');
  });

  it('returns optimal for 0.8 to 1.3', () => {
    expect(getACWRZone(0.8)).toBe('optimal');
    expect(getACWRZone(1.0)).toBe('optimal');
    expect(getACWRZone(1.3)).toBe('optimal');
  });

  it('returns caution for 1.3 to 1.5', () => {
    expect(getACWRZone(1.31)).toBe('caution');
    expect(getACWRZone(1.4)).toBe('caution');
    expect(getACWRZone(1.5)).toBe('caution');
  });

  it('returns danger for > 1.5', () => {
    expect(getACWRZone(1.51)).toBe('danger');
    expect(getACWRZone(1.6)).toBe('danger');
  });
});
