import { describe, expect, it } from 'vitest';
import type { WorkoutLog } from '@/contracts/domain';
import { buildWorkoutLog, sequentialIds } from '@/contracts/fixtures';
import { e1rmMaxReps, latestBestE1rm } from '../pinned-math';

const NOW = new Date(2026, 8, 23, 12, 0, 0);
const ids = sequentialIds('pm');
const EX = 'ex-a';

function log(daysAgo: number, sets: Array<{ kg: number; reps: number }>, extra: Partial<WorkoutLog> = {}): WorkoutLog {
  return { ...buildWorkoutLog('p1', { daysAgo, exercises: [{ exerciseId: EX, sets }] }, NOW, ids), ...extra };
}

describe('e1rmMaxReps', () => {
  it("uses the training module's E1RM_MAX_REPS when exported, else 12", () => {
    expect(e1rmMaxReps({ E1RM_MAX_REPS: 10 })).toBe(10);
    expect(e1rmMaxReps({})).toBe(12);
    expect(e1rmMaxReps({ E1RM_MAX_REPS: 'x' })).toBe(12);
    expect(e1rmMaxReps()).toBe(12);
  });
});

describe('latestBestE1rm', () => {
  it('takes the best set of the newest session regardless of input order', () => {
    const older = log(5, [{ kg: 200, reps: 1 }]);
    // 80 × 8 → 80 × 36 / 29 = 99.310…; 100 × 3 → 100 × 36 / 34 = 105.882…
    const newer = log(1, [{ kg: 80, reps: 8 }, { kg: 100, reps: 3 }]);
    const r = latestBestE1rm([older, newer], EX, 12);
    expect(r?.logId).toBe(newer.id);
    expect(r?.e1rm).toBeCloseTo(3600 / 34, 6);
  });

  it('skips deleted logs, time sets and sets above the rep cap', () => {
    const base = log(4, [{ kg: 50, reps: 2 }]); // 50 × 36 / 35 = 51.428…
    const deleted = log(2, [{ kg: 100, reps: 5 }], { deletedAt: NOW.toISOString() });
    const timed = log(1, [{ kg: 40, reps: 1 }]);
    timed.exercises[0].sets[0].durationSeconds = 60;
    const highReps = log(0.5, [{ kg: 60, reps: 13 }]);
    expect(latestBestE1rm([highReps, timed, deleted, base], EX, 12)?.e1rm).toBeCloseTo(1800 / 35, 6);
    // With a cap of 13 the 13-rep set ranks: 60 × 36 / 24 = 90.
    expect(latestBestE1rm([highReps, timed, deleted, base], EX, 13)?.e1rm).toBe(90);
  });

  it('is null without a rankable set', () => {
    expect(latestBestE1rm([], EX, 12)).toBeNull();
    expect(latestBestE1rm([log(1, [{ kg: 0, reps: 5 }])], EX, 12)).toBeNull();
    expect(latestBestE1rm([log(1, [{ kg: 100, reps: 5 }])], 'other', 12)).toBeNull();
  });
});
