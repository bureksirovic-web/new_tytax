import { describe, expect, it } from 'vitest';
import { buildWorkoutLog, sequentialIds } from '@/contracts/fixtures';
import {
  averageRir,
  densityPerMin,
  durationMinutes,
  formatLogDate,
  groupByMonth,
  setRows,
  splitExercises,
} from '../log-math';

const NOW = new Date(2026, 8, 16, 18, 0, 0);

// Spec §3.2 hand-check: done working 100×5, 100×5 (bench) + 30×10 row;
// warm-up 50×10 and undone 100×5 excluded → 500 + 500 + 300 = 1 300 kg.
// 1 800 s → 30 min → density 1300/30 = 43.3 → 43. RIRs 2, 1, none → 1.5.
function specLog() {
  return buildWorkoutLog(
    'p1',
    {
      daysAgo: 0,
      durationSeconds: 1800,
      exercises: [
        {
          exerciseId: 'bench',
          sets: [
            { kg: 50, reps: 10, type: 'warmup', rir: 5 },
            { kg: 100, reps: 5, rir: 2 },
            { kg: 100, reps: 5, rir: 1 },
            { kg: 100, reps: 5, done: false, rir: 0 },
          ],
        },
        { exerciseId: 'row', sets: [{ kg: 30, reps: 10 }] },
        { exerciseId: 'skipped', sets: [{ kg: 20, reps: 10, done: false }] },
      ],
    },
    NOW,
    sequentialIds('m'),
  );
}

describe('log math', () => {
  it('matches the spec hand-check (volume, density, intensity)', () => {
    const log = specLog();
    expect(log.totalVolumeKg).toBe(1300);
    expect(densityPerMin(log, 'kg')).toBe(43);
    // lb: 43.33 kg/min × 2.20462 = 95.53 → 95.5 → round 96
    expect(densityPerMin(log, 'lb')).toBe(96);
    expect(averageRir(log)).toBe(1.5);
  });

  it('duration is whole minutes and never below 1', () => {
    expect(durationMinutes(0)).toBe(1);
    expect(durationMinutes(59)).toBe(1);
    expect(durationMinutes(3599)).toBe(59);
    expect(durationMinutes(3600)).toBe(60);
  });

  it('average RIR is null without recorded working RIRs', () => {
    const log = buildWorkoutLog('p1', { daysAgo: 0, exercises: [{ exerciseId: 'x', sets: [{ kg: 1, reps: 1 }] }] }, NOW, sequentialIds());
    expect(averageRir(log)).toBeNull();
  });

  it('hides exercises without done sets and counts them', () => {
    const { shown, skipped } = splitExercises(specLog());
    expect(shown.map((e) => e.exerciseId)).toEqual(['bench', 'row']);
    expect(skipped).toBe(1);
  });

  it('numbers working sets 1..n, leaves warm-ups unnumbered, hides undone unless asked', () => {
    const bench = specLog().exercises[0];
    expect(setRows(bench, false).map((r) => r.number)).toEqual([null, 1, 2]);
    expect(setRows(bench, true).map((r) => r.number)).toEqual([null, 1, 2, 3]);
  });

  it('formats the local calendar day without a UTC shift', () => {
    expect(formatLogDate({ date: '2026-09-01' }, 'en')).toContain('1');
    expect(formatLogDate({ date: '2026-09-01' }, 'en')).toContain('Sept');
    expect(formatLogDate({ date: '2026-09-01' }, 'en', { weekday: 'long' })).toBe('Tuesday');
  });

  it('groups consecutive logs by month', () => {
    const ids = sequentialIds('g');
    const mk = (daysAgo: number) => buildWorkoutLog('p', { daysAgo, exercises: [] }, NOW, ids);
    // NOW = 2026-09-16: 0 and 10 days ago → September; 20 days ago → 2026-08-27.
    const groups = groupByMonth([mk(0), mk(10), mk(20)]);
    expect(groups.map((g) => [g.key, g.logs.length])).toEqual([
      ['2026-09', 2],
      ['2026-08', 1],
    ]);
  });
});
