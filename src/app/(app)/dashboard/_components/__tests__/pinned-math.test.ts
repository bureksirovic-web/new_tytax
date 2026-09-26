import { describe, expect, it } from 'vitest';
import type { WorkoutLog } from '@/contracts/domain';
import { buildWorkoutLog, sequentialIds } from '@/contracts/fixtures';
import { E1RM_MAX_REPS } from '@/lib/training';
import { latestBestE1rm } from '../pinned-math';

const NOW = new Date(2026, 8, 23, 12, 0, 0);
const ids = sequentialIds('pm');
const EX = 'ex-a';

function log(daysAgo: number, sets: Array<{ kg: number; reps: number }>, extra: Partial<WorkoutLog> = {}): WorkoutLog {
  return { ...buildWorkoutLog('p1', { daysAgo, exercises: [{ exerciseId: EX, sets }] }, NOW, ids), ...extra };
}

describe('latestBestE1rm', () => {
  it('takes the best set of the newest session regardless of input order', () => {
    const older = log(5, [{ kg: 200, reps: 1 }]);
    // 80 × 8 → 80 × 36 / 29 = 99.310…; 100 × 3 → 100 × 36 / 34 = 105.882…
    const newer = log(1, [{ kg: 80, reps: 8 }, { kg: 100, reps: 3 }]);
    const r = latestBestE1rm([older, newer], EX);
    expect(r?.logId).toBe(newer.id);
    expect(r?.e1rm).toBeCloseTo(3600 / 34, 2);
  });

  it('skips deleted logs, time sets and sets above the rep cap', () => {
    const base = log(4, [{ kg: 50, reps: 2 }]); // 50 × 36 / 35 = 51.428…
    const deleted = log(2, [{ kg: 100, reps: 5 }], { deletedAt: NOW.toISOString() });
    const timed = log(1, [{ kg: 40, reps: 1 }]);
    timed.exercises[0].sets[0].durationSeconds = 60;
    const highReps = log(0.5, [{ kg: 60, reps: 13 }]);
    expect(E1RM_MAX_REPS).toBe(12);
    expect(latestBestE1rm([highReps, timed, deleted, base], EX)?.e1rm).toBeCloseTo(1800 / 35, 2);
    // At the cap a set still ranks: 60 × 36 / 25 = 86.4.
    expect(latestBestE1rm([log(0.5, [{ kg: 60, reps: 12 }]), base], EX)?.e1rm).toBe(86.4);
  });

  it('is null without a rankable set', () => {
    expect(latestBestE1rm([], EX)).toBeNull();
    expect(latestBestE1rm([log(1, [{ kg: 0, reps: 5 }])], EX)).toBeNull();
    expect(latestBestE1rm([log(1, [{ kg: 100, reps: 5 }])], 'other')).toBeNull();
  });
});
