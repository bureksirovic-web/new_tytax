/** G3-W2-03: `seedHistory` can build time-measured sets (SeedSetInput.durationSeconds). */
import { describe, expect, it } from 'vitest';
import { buildWorkoutLog, sequentialIds } from '../fixtures';

describe('buildWorkoutLog with time sets', () => {
  it('copies durationSeconds onto the set and keeps time sets out of kg volume', () => {
    const now = new Date('2026-03-10T12:00:00.000Z');
    const log = buildWorkoutLog(
      'p1',
      {
        daysAgo: 1,
        exercises: [
          { exerciseId: 'plank', modality: 'bodyweight', sets: [{ kg: 0, reps: 0, durationSeconds: 45 }] },
          // A weighted carry held for 30 s: 20 kg must not become kg volume.
          { exerciseId: 'carry', sets: [{ kg: 20, reps: 1, durationSeconds: 30 }] },
          { exerciseId: 'bench', sets: [{ kg: 100, reps: 5 }] },
        ],
      },
      now,
      sequentialIds('t'),
    );
    const [plank, carry, bench] = log.exercises;
    expect(plank.sets[0].durationSeconds).toBe(45);
    expect(carry.sets[0].durationSeconds).toBe(30);
    expect('durationSeconds' in bench.sets[0]).toBe(false);
    expect(log.totalVolumeKg).toBe(500);
    expect(log.totalSets).toBe(3);
  });
});
