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
    // first day with volume → W = floor(0/7)+1 = 1 week; acute = 1000/7, chronic = (1000/1)/7 = 1000/7 → ratio 1
    expect(result[0].acute).toBeCloseTo(1000 / 7, 10);
    expect(result[0].chronic).toBeCloseTo(1000 / 7, 10);
    expect(result[0].ratio).toBe(1.0);
    expect(result[0].zone).toBe('optimal');
  });

  it('calculates higher ratio for high recent volume', () => {
    const logs = [
      volumeLog('2024-01-01', 1000),
      volumeLog('2024-01-08', 1000),
      volumeLog('2024-01-15', 1000),
      volumeLog('2024-01-22', 4000),
    ];
    const last = computeACWR(logs).at(-1);
    // history 01-01 → 01-22 = 21 d → W = floor(21/7)+1 = 4; acute (01-16..01-22) = 4000/7;
    // chronic (2023-12-26..2024-01-22) = (7000/4)/7 = 250 → ratio (4000/7)/250 = 16/7 ≈ 2.2857
    expect(last?.ratio).toBeCloseTo(16 / 7, 10);
    expect(last?.zone).toBe('danger');
    // 2024-01-22 is a Monday: its week holds only that session → 4000
    expect(last?.weeklyVolume).toBe(4000);
  });

  it('cold start: sessions in the first week compare with one week, not an empty month', () => {
    const rows = computeACWR([volumeLog('2024-01-01', 1000), volumeLog('2024-01-03', 1000)]);
    // 01-03: 2 d of history → W = floor(2/7)+1 = 1; acute = 2000/7; chronic = (2000/1)/7 = 2000/7 → ratio 1
    // (dividing by 4 weeks gave chronic 2000/28 → ratio 4 → danger)
    expect(rows[1].acute).toBeCloseTo(2000 / 7, 10);
    expect(rows[1].chronic).toBeCloseTo(2000 / 7, 10);
    expect(rows[1].ratio).toBeCloseTo(1, 10);
    expect(rows.map((r) => r.zone)).toEqual(['optimal', 'optimal']);
  });

  it('a session exactly 7 days after the first means two weeks of history', () => {
    const rows = computeACWR([volumeLog('2024-01-01', 1000), volumeLog('2024-01-08', 1000)]);
    // 01-08: 7 d → W = floor(7/7)+1 = 2; acute (01-02..01-08) = 1000/7;
    // chronic (12-12..01-08) = (2000/2)/7 = 1000/7 → ratio 1
    expect(rows[1].acute).toBeCloseTo(1000 / 7, 10);
    expect(rows[1].chronic).toBeCloseTo(1000 / 7, 10);
    expect(rows[1].ratio).toBeCloseTo(1, 10);
  });

  it('steady weekly load keeps ratio 1 while W grows by calendar week and clamps at 4', () => {
    const logs = ['2024-01-01', '2024-01-08', '2024-01-15', '2024-01-22', '2024-01-29', '2024-02-05'].map((d) => volumeLog(d, 700));
    const rows = computeACWR(logs);
    // row i is i×7 d after 01-01 → W = min(4, i+1) = 1, 2, 3, 4, 4, 4; 28-day window holds min(i+1, 4) sessions
    // → chronic = (700 × min(i+1, 4) / W) / 7 = 100 and acute = 700/7 = 100 every week → ratio 1 throughout
    for (const r of rows) {
      expect(r.chronic).toBeCloseTo(100, 10);
      expect(r.ratio).toBeCloseTo(1, 10);
    }
  });

  it('a zero-volume earlier day does not start history', () => {
    const logs = [
      makeLog('2024-01-01', [{ id: 'x', sets: [{ kg: 40, reps: 10, type: 'warmup' }, { kg: 0, reps: 10 }] }]),
      volumeLog('2024-01-15', 1000),
    ];
    const rows = computeACWR(logs);
    // 01-01: warm-up excluded, 0 kg × 10 = 0 → no volume → chronic 0 → ratio falls back to 1
    expect(rows[0]).toMatchObject({ acute: 0, chronic: 0, ratio: 1 });
    // 01-15 is the first day with volume → W = 1 (not floor(14/7)+1 = 3); chronic = 1000/7 = acute → ratio 1
    expect(rows[1].chronic).toBeCloseTo(1000 / 7, 10);
    expect(rows[1].ratio).toBeCloseTo(1, 10);
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
