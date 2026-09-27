import { describe, expect, it } from 'vitest';
import { analyzeMuscleGaps } from '../gap-analysis';
import { getBestLifts, getE1RMProgression } from '../pr-tracker';
import { countedSets, exerciseVolume, logVolume, setVolume } from '../sets';
import { computeWeeklyVolume, volumeByMuscle } from '../volume';
import { makeLog } from './fixtures';

const CORE = [{ muscle: 'Core', score: 100 }];
const CHEST = [{ muscle: 'Chest', score: 100 }];

/** plank: a 20 kg × 0 rep 45 s hold and a 100 kg × 5 rep 30 s hold (reps typed next to seconds); press: 100 × 5. */
function mixedLog(date = '2024-01-01') {
  return makeLog(date, [
    {
      id: 'plank',
      sets: [
        { kg: 20, reps: 0, durationSeconds: 45 },
        { kg: 100, reps: 5, durationSeconds: 30 },
      ],
      impact: CORE,
    },
    { id: 'press', sets: [{ kg: 100, reps: 5 }], impact: CHEST },
  ]);
}

describe('time sets carry no kg volume', () => {
  it('are counted sets with 0 volume', () => {
    const [plank, press] = mixedLog().exercises;
    // both time sets are done working sets
    expect(countedSets(plank)).toHaveLength(2);
    // 100 × 5 would be 500 as a reps set; as a time set it is 0
    expect(setVolume(plank.sets[1])).toBe(0);
    expect(exerciseVolume(plank)).toBe(0);
    // press 100 × 5 = 500
    expect(exerciseVolume(press)).toBe(500);
  });

  it('log, weekly and per-muscle volume skip them', () => {
    const logs = [mixedLog()];
    // only press 100 × 5 = 500
    expect(logVolume(logs[0])).toBe(500);
    const [week] = computeWeeklyVolume(logs);
    expect(week).toMatchObject({ totalVolume: 500, sessionCount: 1, byModality: { tytax: 500 } });
    // Chest 500 × 1.0 = 500; no Core key (the holds added nothing)
    expect(week.byMuscle).toEqual({ Chest: 500 });
    expect(volumeByMuscle(logs)).toEqual({ Chest: 500 });
  });

  it('a time-only log has no volume and no muscle gap entry', () => {
    const now = new Date(2024, 0, 2);
    const log = makeLog('2024-01-01', [{ id: 'plank', sets: [{ kg: 20, reps: 0, durationSeconds: 45 }], impact: CORE }]);
    expect(logVolume(log)).toBe(0);
    expect(computeWeeklyVolume([log])[0]).toMatchObject({ totalVolume: 0, byModality: {}, byMuscle: {}, sessionCount: 1 });
    expect(analyzeMuscleGaps([log], 30, { now })).toEqual([]);
  });
});

describe('time sets never give e1RM', () => {
  it('getBestLifts and getE1RMProgression skip them', () => {
    const logs = [
      makeLog('2024-01-01', [{ id: 'hold', sets: [{ kg: 100, reps: 5, durationSeconds: 30 }] }]),
      makeLog('2024-01-02', [{ id: 'hold', sets: [{ kg: 100, reps: 5, durationSeconds: 30 }, { kg: 60, reps: 10 }] }]),
    ];
    const best = getBestLifts(logs);
    // 100×5 time sets skipped (would be 112.5); 60×10 → 60×36/27 = 80
    expect(best['hold']).toEqual({ weight: 60, reps: 10, e1rm: 80, date: '2024-01-02' });
    // day 1 has only a time set → no point; day 2 → 80
    expect(getE1RMProgression(logs, 'hold').map((p) => [p.date, p.e1rm])).toEqual([['2024-01-02', 80]]);
    expect(getBestLifts([logs[0]])['hold']).toBeUndefined();
  });
});
