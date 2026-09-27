import { describe, it, expect } from 'vitest';
import { E1RM_MAX_REPS, E1RM_PR_MAX_REPS } from '@/lib/training';
import { getE1RMProgression, getBestLifts } from '../pr-tracker';
import { makeLog, type FixtureSet } from './fixtures';

function log(date: string, exercises: Array<{ ref: string; sets: FixtureSet[] }>, deletedAt?: string) {
  return makeLog(date, exercises.map((e) => ({ id: e.ref, sets: e.sets })), deletedAt ? { deletedAt } : {});
}

describe('getE1RMProgression', () => {
  it('tracks best e1RM per exercise per day', () => {
    const result = getE1RMProgression(
      [log('2024-01-01', [{ ref: 'ex1', sets: [{ kg: 100, reps: 5 }] }]), log('2024-01-02', [{ ref: 'ex1', sets: [{ kg: 105, reps: 5 }] }])],
      'ex1',
    );
    expect(result.map((p) => p.date)).toEqual(['2024-01-01', '2024-01-02']);
    // Brzycki: 100*36/32 = 112.5; 105*36/32 = 118.125
    expect(result.map((p) => p.e1rm)).toEqual([112.5, 118.125]);
  });

  it('ignores reps=0, kg=0, undone and warm-up sets', () => {
    const sets: FixtureSet[] = [
      { kg: 100, reps: 0 },
      { kg: 0, reps: 5 },
      { kg: 100, reps: 5, done: false },
      { kg: 200, reps: 1, type: 'warmup' },
    ];
    expect(getE1RMProgression([log('2024-01-01', [{ ref: 'ex1', sets }])], 'ex1')).toHaveLength(0);
  });

  it('skips soft-deleted logs', () => {
    const logs = [
      log('2024-01-01', [{ ref: 'ex1', sets: [{ kg: 100, reps: 5 }] }]),
      log('2024-01-02', [{ ref: 'ex1', sets: [{ kg: 300, reps: 5 }] }], '2024-01-03T00:00:00.000Z'),
    ];
    const result = getE1RMProgression(logs, 'ex1');
    // only 2024-01-01 remains: 112.5
    expect(result).toHaveLength(1);
    expect(result[0].e1rm).toBe(112.5);
  });

  it('returns chronologically sorted results', () => {
    const logs = [
      log('2024-01-05', [{ ref: 'ex1', sets: [{ kg: 100, reps: 5 }] }]),
      log('2024-01-01', [{ ref: 'ex1', sets: [{ kg: 90, reps: 5 }] }]),
      log('2024-01-03', [{ ref: 'ex1', sets: [{ kg: 95, reps: 5 }] }]),
    ];
    expect(getE1RMProgression(logs, 'ex1').map((p) => p.date)).toEqual(['2024-01-01', '2024-01-03', '2024-01-05']);
  });

  it('picks the best e1RM for a day with multiple sets', () => {
    const sets: FixtureSet[] = [
      { kg: 80, reps: 8 },
      { kg: 100, reps: 5 },
      { kg: 90, reps: 6 },
    ];
    const result = getE1RMProgression([log('2024-01-01', [{ ref: 'ex1', sets }])], 'ex1');
    // 80×8 → 2880/29 = 99.31; 100×5 → 112.5; 90×6 → 3240/31 = 104.52 → best 100×5
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ weight: 100, reps: 5, e1rm: 112.5, exerciseId: 'ex1' });
  });

  it('returns empty array for no matching exercise', () => {
    expect(getE1RMProgression([log('2024-01-01', [{ ref: 'ex1', sets: [{ kg: 100, reps: 5 }] }])], 'ex2')).toHaveLength(0);
  });
});

describe('getBestLifts', () => {
  it('returns best lifts across all exercises', () => {
    const result = getBestLifts([
      log('2024-01-01', [
        { ref: 'ex1', sets: [{ kg: 100, reps: 5 }] },
        { ref: 'ex2', sets: [{ kg: 80, reps: 8 }] },
      ]),
    ]);
    expect(result['ex1'].weight).toBe(100);
    expect(result['ex2'].weight).toBe(80);
    // 80×8 → 80*36/29 = 99.310…
    expect(result['ex2'].e1rm).toBeCloseTo(99.3103, 4);
  });

  it('ignores incomplete sets', () => {
    const result = getBestLifts([
      log('2024-01-01', [
        { ref: 'ex1', sets: [{ kg: 0, reps: 5 }, { kg: 100, reps: 0 }, { kg: 100, reps: 5, done: false }] },
      ]),
    ]);
    expect(result['ex1']).toBeUndefined();
  });

  it('tracks best e1RM across multiple days', () => {
    const result = getBestLifts([
      log('2024-01-01', [{ ref: 'ex1', sets: [{ kg: 100, reps: 5 }] }]),
      log('2024-01-05', [{ ref: 'ex1', sets: [{ kg: 90, reps: 8 }] }]),
    ]);
    // 100×5 → 112.5 beats 90×8 → 90*36/29 = 111.72
    expect(result['ex1'].e1rm).toBe(112.5);
    expect(result['ex1'].date).toBe('2024-01-01');
  });

  it('includes date of best lift and skips deleted logs', () => {
    const result = getBestLifts([
      log('2024-01-01', [{ ref: 'ex1', sets: [{ kg: 100, reps: 5 }] }]),
      log('2024-01-09', [{ ref: 'ex1', sets: [{ kg: 150, reps: 5 }] }], '2024-01-10T00:00:00.000Z'),
    ]);
    expect(result['ex1'].date).toBe('2024-01-01');
    // deleted 150×5 ignored → 100 kg stands
    expect(result['ex1'].weight).toBe(100);
  });
});

describe('e1RM rep cap (E1RM_MAX_REPS = 12)', () => {
  it('exports the cap and keeps the PR alias', () => {
    expect(E1RM_MAX_REPS).toBe(12);
    expect(E1RM_PR_MAX_REPS).toBe(E1RM_MAX_REPS);
  });

  it('getBestLifts skips sets above 12 reps', () => {
    const result = getBestLifts([log('2024-01-01', [{ ref: 'ex1', sets: [{ kg: 16, reps: 35 }, { kg: 30, reps: 8 }] }])]);
    // 16×35 would be 16*36/2 = 288 but is skipped (35 > 12); 30×8 → 30*36/29 = 1080/29 = 37.2414 (unrounded)
    expect(result['ex1']).toMatchObject({ weight: 30, reps: 8 });
    expect(result['ex1'].e1rm).toBeCloseTo(1080 / 29, 10);
    expect(Math.round(result['ex1'].e1rm * 100) / 100).toBe(37.24);
  });

  it('a log with only a high-rep set gives no best lift and no progression point', () => {
    const logs = [log('2024-01-01', [{ ref: 'ex1', sets: [{ kg: 16, reps: 35 }] }])];
    expect(getBestLifts(logs)['ex1']).toBeUndefined();
    expect(getE1RMProgression(logs, 'ex1')).toEqual([]);
  });

  it('getE1RMProgression keeps 12-rep sets and drops 13-rep sets', () => {
    const logs = [
      log('2024-01-01', [{ ref: 'ex1', sets: [{ kg: 50, reps: 12 }] }]),
      log('2024-01-02', [{ ref: 'ex1', sets: [{ kg: 60, reps: 13 }, { kg: 16, reps: 35 }] }]),
    ];
    const result = getE1RMProgression(logs, 'ex1');
    // 50×12 → 50*36/25 = 72 counts (12 ≤ 12); day 2 has only 13 and 35 reps → no point
    expect(result.map((p) => [p.date, p.e1rm])).toEqual([['2024-01-01', 72]]);
  });
});
