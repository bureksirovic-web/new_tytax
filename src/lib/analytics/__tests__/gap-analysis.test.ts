import { describe, it, expect } from 'vitest';
import { analyzeMuscleGaps } from '../gap-analysis';
import { daysBefore, makeLog } from './fixtures';

const NOW = new Date(2026, 8, 20, 12, 0, 0);

describe('analyzeMuscleGaps', () => {
  it('shares impact-weighted volume per standardised muscle and classifies it', () => {
    const logs = [
      makeLog(daysBefore(NOW, 2), [
        { id: 'a', sets: [{ kg: 100, reps: 10 }], impact: [{ muscle: 'Chest', score: 100 }, { muscle: 'Triceps', score: 50 }] },
        { id: 'b', sets: [{ kg: 10, reps: 3 }], impact: [{ muscle: 'Rear Delt', score: 100 }] },
      ]),
      makeLog(daysBefore(NOW, 1), [{ id: 'a', sets: [{ kg: 100, reps: 10 }], impact: [{ muscle: 'Chest', score: 100 }] }]),
    ];
    const r = analyzeMuscleGaps(logs, 30, { now: NOW });
    // Chest 1000 + 1000 = 2000; Triceps 1000×.5 = 500; Rear Delt → Rear Delts 30; total 2530
    expect(r.map((g) => [g.muscle, g.volume])).toEqual([
      ['Chest', 2000],
      ['Triceps', 500],
      ['Rear Delts', 30],
    ]);
    // Chest 2000/2530 = 79 % → overtrained; Triceps 19.8 % → balanced; Rear Delts 1.2 % → neglected
    expect(r.map((g) => g.status)).toEqual(['overtrained', 'balanced', 'neglected']);
    expect(r[0].lastTrained).toBe(daysBefore(NOW, 1));
    expect(r[1].lastTrained).toBe(daysBefore(NOW, 2));
  });

  it('respects the window, done working sets and soft-deletes', () => {
    const impact = [{ muscle: 'Quads', score: 100 }];
    const logs = [
      makeLog(daysBefore(NOW, 40), [{ id: 'q', sets: [{ kg: 100, reps: 10 }], impact }]),
      makeLog(daysBefore(NOW, 3), [{ id: 'q', sets: [{ kg: 100, reps: 10 }], impact }], { deletedAt: 'x' }),
      makeLog(daysBefore(NOW, 3), [{ id: 'q', sets: [{ kg: 60, reps: 5, type: 'warmup' }, { kg: 100, reps: 5 }], impact }]),
    ];
    const r = analyzeMuscleGaps(logs, 30, { now: NOW });
    // only the live, in-window working set counts: 100×5 = 500 → 100 %
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ muscle: 'Quads', volume: 500, percentageOfTotal: 100 });
    expect(analyzeMuscleGaps([], 30, { now: NOW })).toEqual([]);
  });
});
