import { describe, expect, it } from 'vitest';
import type { WorkoutLog } from '@/contracts/domain';
import { recoveryStatus, training } from '../index';
import { HOUR, logEndingAt, lookup, sets } from './helpers';

// 01:00 UTC, so 47 h and 49 h ago fall on the same calendar day (2026-09-18),
// 02:00 and 00:00 UTC: a calendar-day window could not tell them apart.
const NOW = new Date('2026-09-20T01:00:00Z');

function muscle(r: ReturnType<typeof recoveryStatus>, name: string) {
  return r.muscles.find((m) => m.muscle === name);
}

describe('recoveryStatus', () => {
  it('uses a real 48 h window: 47 h ago counts, 49 h ago does not (across midnight)', () => {
    const in47 = logEndingAt(NOW, 47, [{ exerciseId: 'press', sets: sets(2) }]);
    const out49 = logEndingAt(NOW, 49, [{ exerciseId: 'press', sets: sets(10) }]);
    expect(in47.finishedAt).toBe('2026-09-18T02:00:00.000Z');
    expect(out49.finishedAt).toBe('2026-09-18T00:00:00.000Z');
    const r = recoveryStatus([out49, in47], lookup, NOW);
    // Chest: only the 47 h log → 2 sets × 1.0 = 2 → recovering (0 < 2 < 6)
    expect(muscle(r, 'Chest')).toEqual({
      muscle: 'Chest',
      status: 'recovering',
      lastTrainedAt: '2026-09-18T02:00:00.000Z',
      hoursSince: 47,
      load48h: 2,
    });
    // Triceps: 2 × 0.5 = 1
    expect(muscle(r, 'Triceps')?.load48h).toBe(1);
    expect(r.overall).toBe('recovering');
  });

  it('exactly 48 h ago is inside the window', () => {
    const log = logEndingAt(NOW, 48, [{ exerciseId: 'curl', sets: sets(1) }]);
    // Biceps 1 × 1.0 = 1
    expect(muscle(recoveryStatus([log], lookup, NOW), 'Biceps')?.load48h).toBe(1);
  });

  it('load ≥ 6 is fried; overall is the worst state', () => {
    const log = logEndingAt(NOW, 5, [{ exerciseId: 'press', sets: sets(6) }]);
    const r = training.recoveryStatus([log], lookup, NOW);
    // Chest 6 × 1.0 = 6 ≥ 6 → fried; Triceps 6 × 0.5 = 3 → recovering
    expect(muscle(r, 'Chest')?.status).toBe('fried');
    expect(muscle(r, 'Triceps')?.status).toBe('recovering');
    expect(r.overall).toBe('fried');
    // sorted by load desc: Chest (6) before Triceps (3)
    expect(r.muscles.map((m) => m.muscle)).toEqual(['Chest', 'Triceps']);
  });

  it('a muscle trained only before the window is fresh but keeps lastTrainedAt', () => {
    const log = logEndingAt(NOW, 72, [{ exerciseId: 'curl', sets: sets(8) }]);
    const r = recoveryStatus([log], lookup, NOW);
    // 72 h ago: outside 48 h → load 0 → fresh; hoursSince 72
    expect(muscle(r, 'Biceps')).toMatchObject({ status: 'fresh', load48h: 0, hoursSince: 72 });
    expect(muscle(r, 'Biceps')?.lastTrainedAt).toBe(new Date(NOW.getTime() - 72 * HOUR).toISOString());
    expect(r.overall).toBe('fresh');
  });

  it('warm-ups, undone sets, soft-deleted and future logs never count', () => {
    const log = logEndingAt(NOW, 10, [
      {
        exerciseId: 'press',
        sets: [...sets(5), { kg: 20, reps: 10, type: 'warmup' }, { kg: 20, reps: 10, type: 'warmup' }, { kg: 80, reps: 5, done: false }],
      },
    ]);
    const deleted = logEndingAt(NOW, 2, [{ exerciseId: 'press', sets: sets(10) }], { deleted: true });
    const future = logEndingAt(NOW, -3, [{ exerciseId: 'press', sets: sets(10) }]);
    const r = recoveryStatus([log, deleted, future], lookup, NOW);
    // Chest: only the 5 done working sets → 5 < 6 → recovering, not fried
    expect(muscle(r, 'Chest')).toMatchObject({ load48h: 5, status: 'recovering', hoursSince: 10 });
    expect(r.overall).toBe('recovering');
  });

  it('falls back to startedAt when finishedAt is not a timestamp', () => {
    const base = logEndingAt(NOW, 30, [{ exerciseId: 'curl', sets: sets(1) }]);
    const log: WorkoutLog = { ...base, finishedAt: '' };
    // startedAt = 30 h ago (duration 0) → inside → Biceps 1
    expect(muscle(recoveryStatus([log], lookup, NOW), 'Biceps')).toMatchObject({ load48h: 1, hoursSince: 30 });
  });

  it('no logs → overall fresh, no muscles', () => {
    expect(recoveryStatus([], lookup, NOW)).toEqual({ overall: 'fresh', muscles: [] });
  });
});
