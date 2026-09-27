import { describe, expect, it } from 'vitest';
import type { Program, ProgramSession } from '@/contracts/domain';
import { buildWorkoutLog, sequentialIds } from '@/contracts/fixtures';
import {
  doneWorkingVolume,
  isoWeekStart,
  pluralCategory,
  predictSession,
  volumeRangeStart,
  weeklyVolume,
} from '../dashboard-math';

// Wednesday 2026-09-23, 12:00 local time.
const WED = new Date(2026, 8, 23, 12, 0, 0);

describe('ISO week helpers', () => {
  it('starts the week on Monday (local)', () => {
    expect(isoWeekStart(WED)).toBe('2026-09-21');
    // Sunday belongs to the week that started the previous Monday.
    expect(isoWeekStart(new Date(2026, 8, 27, 23, 30))).toBe('2026-09-21');
    // Monday 00:10 is its own week start (a UTC-based helper would give Sunday).
    expect(isoWeekStart(new Date(2026, 8, 28, 0, 10))).toBe('2026-09-28');
  });

  it('loads from last week Monday', () => {
    expect(volumeRangeStart(WED)).toBe('2026-09-14');
    // Across a month boundary: Thu 2026-10-01 → this Monday 09-28 → last Monday 09-21.
    expect(volumeRangeStart(new Date(2026, 9, 1, 9))).toBe('2026-09-21');
  });
});

describe('weeklyVolume', () => {
  const ids = sequentialIds('v');
  const log = (daysAgo: number, sets: { kg: number; reps: number; done?: boolean; type?: 'warmup' | 'working' }[], deleted = false) =>
    buildWorkoutLog('p1', { daysAgo, deleted, exercises: [{ exerciseId: 'x', sets }] }, WED, ids);

  it('counts only done working sets, splits this ISO week from last, skips deleted logs', () => {
    const logs = [
      // Tue 09-22 (this week): 100×5 + 100×5 done = 1000; warm-up 60×5 and undone 100×5 ignored.
      log(1, [
        { kg: 100, reps: 5 },
        { kg: 100, reps: 5 },
        { kg: 60, reps: 5, type: 'warmup' },
        { kg: 100, reps: 5, done: false },
      ]),
      // Fri 09-18 (last week): 80×10 = 800.
      log(5, [{ kg: 80, reps: 10 }]),
      // Thu 09-17 (last week) but soft-deleted: ignored.
      log(6, [{ kg: 500, reps: 10 }], true),
      // Sun 09-13 is before last Monday: ignored.
      log(10, [{ kg: 999, reps: 1 }]),
    ];
    const v = weeklyVolume(logs, WED);
    expect(v.thisWeekKg).toBe(1000);
    expect(v.lastWeekKg).toBe(800);
    // W2: Fri 09-18 is after the same point last week (Wed 09-16 12:00): nothing to compare with yet.
    expect(v.lastWeekToDateKg).toBe(0);
    expect(v.changePct).toBeNull();
    expect(doneWorkingVolume(logs[0])).toBe(1000);
  });

  it('has no change figure when last week was empty', () => {
    const v = weeklyVolume([log(0, [{ kg: 50, reps: 10 }])], WED);
    expect(v).toEqual({ thisWeekKg: 500, lastWeekKg: 0, lastWeekToDateKg: 0, changePct: null });
  });
});

describe('predictSession', () => {
  const session = (i: number, isRest = false): ProgramSession => ({
    id: `s${i}`,
    programId: 'p',
    name: `S${i}`,
    dayIndex: i,
    exercises: [],
    isRest,
  });
  const program = (currentSessionIndex: number, sessions: ProgramSession[]) =>
    ({ id: 'p', currentSessionIndex, sessions }) as unknown as Program;

  it('follows the rotation pointer and wraps like the workout store', () => {
    const s = [session(0), session(1, true), session(2)];
    expect(predictSession(program(0, s))?.session.name).toBe('S0');
    expect(predictSession(program(1, s))?.session.isRest).toBe(true);
    // 4 mod 3 = 1; −1 wraps to 2.
    expect(predictSession(program(4, s))?.index).toBe(1);
    expect(predictSession(program(-1, s))?.index).toBe(2);
    expect(predictSession(program(0, []))).toBeUndefined();
  });
});

describe('pluralCategory', () => {
  it('uses the Croatian one/few/other forms', () => {
    expect(['1', '3', '5', '11', '21', '22'].map((n) => pluralCategory(Number(n), 'hr'))).toEqual([
      'one',
      'few',
      'other',
      'other',
      'one',
      'few',
    ]);
    expect(pluralCategory(1, 'en')).toBe('one');
    expect(pluralCategory(3, 'en')).toBe('other');
  });
});
