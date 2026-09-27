import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import type { WorkoutLog } from '@/contracts/domain';
import type { ExerciseLookup } from '@/contracts/training';
import { loadCatalog } from '@/lib/catalog';
import { standardizeMuscle } from '@/lib/constants';
import { logVolumeKg, muscleDistribution } from '../analytics-math';
import { bestLifts, exerciseSeries, movementParity, trainedExercises } from '../exercise-series';
import { MuscleDistribution } from '../muscle-distribution';
import { muscleVolumeKg } from '../muscle-volume';
import { exercise, logsAt, lookupOf, renderEn } from './helpers';

// Saturday 2026-09-26, 18:00 local.
const NOW = new Date(2026, 8, 26, 18, 0);
const none: ExerciseLookup = () => undefined;

/** Marks set `index` of exercise `exIndex` in every log as time-measured (`durationSeconds`). */
function asTimeSet(logs: WorkoutLog[], exIndex: number, index: number, seconds: number): WorkoutLog[] {
  return logs.map((log) => ({
    ...log,
    exercises: log.exercises.map((ex, i) =>
      i !== exIndex ? ex : { ...ex, sets: ex.sets.map((s, j) => (j === index ? { ...s, durationSeconds: seconds } : s)) },
    ),
  }));
}

describe('F8: program logs without a snapshot contribute muscle volume through the catalog lookup', () => {
  it('real catalog entry, no muscleImpactSnapshot on the log', async () => {
    const catalog = await loadCatalog();
    // An entry whose impact muscles standardise to distinct names (no two raw muscles merge),
    // so the per-muscle total is exactly volume × score / 100 under either library signature.
    const entry = catalog.exercises.find((e) => {
      const positive = e.impact.filter((i) => i.score > 0);
      const names = positive.map((i) => standardizeMuscle(i.muscle));
      return positive.length >= 2 && new Set(names).size === names.length;
    });
    expect(entry).toBeDefined();
    const logs = logsAt(NOW, [{ daysAgo: 1, exercises: [{ exerciseId: entry!.id, sets: [{ kg: 50, reps: 10 }, { kg: 50, reps: 10 }] }] }]);
    expect(logs[0].exercises[0].muscleImpactSnapshot).toBeUndefined();

    // without the lookup a program log adds nothing (the F8 bug)…
    expect(muscleVolumeKg(logs, none)).toEqual({});
    // …with it: 2 × 50 kg × 10 = 1000 kg × score / 100 per muscle
    const lookup: ExerciseLookup = (id) => catalog.getById(id);
    const expected = Object.fromEntries(
      entry!.impact.filter((i) => i.score > 0).map((i) => [standardizeMuscle(i.muscle), (1000 * i.score) / 100]),
    );
    const got = muscleVolumeKg(logs, lookup);
    expect(Object.keys(got).sort()).toEqual(Object.keys(expected).sort());
    for (const [muscle, kg] of Object.entries(expected)) expect(got[muscle]).toBeCloseTo(kg, 6);
  });

  it('a snapshot still counts when the catalog has no entry (custom exercise)', () => {
    const logs = logsAt(NOW, [{ daysAgo: 1, exercises: [{ exerciseId: 'custom-x', sets: [{ kg: 40, reps: 10 }] }] }]);
    const withSnapshot = logs.map((l) => ({
      ...l,
      exercises: l.exercises.map((ex) => ({ ...ex, muscleImpactSnapshot: [{ muscle: 'Biceps', score: 80 }] })),
    }));
    // 40 × 10 = 400 kg × .8 = 320 kg
    expect(muscleVolumeKg(withSnapshot, none)).toEqual({ Biceps: 320 });
  });
});

describe('time-measured sets are excluded from kg volume and e1RM', () => {
  const lookup = lookupOf([
    exercise('bench', [{ muscle: 'Chest', score: 100 }], 'horizontal push'),
    exercise('plank', [{ muscle: 'Core', score: 100 }], 'core'),
  ]);
  // bench: 100×5 kg set + a 200 kg × 1 set flagged as time (must never be an e1RM or volume);
  // plank: one time-only set (20 kg vest, 1 rep, 60 s)
  const base = logsAt(NOW, [
    { daysAgo: 1, exercises: [{ exerciseId: 'bench', sets: [{ kg: 100, reps: 5 }, { kg: 200, reps: 1 }] }, { exerciseId: 'plank', sets: [{ kg: 20, reps: 1 }] }] },
  ]);
  const logs = asTimeSet(asTimeSet(base, 0, 1, 30), 1, 0, 60);

  it('log volume, muscle volume, movement balance', () => {
    expect(logVolumeKg(logs[0])).toBe(500); // only 100 × 5
    expect(muscleVolumeKg(logs, lookup)).toEqual({ Chest: 500 });
    // only the bench kg set has volume: push 100 %
    const rows = movementParity(logs, lookup, '2026-01-01');
    expect(rows.find((r) => r.pattern === 'push')?.pct).toBe(100);
    expect(rows.find((r) => r.pattern === 'core')?.pct).toBe(0);
  });

  it('e1RM series, best lifts and the trained list skip time sets', () => {
    const series = exerciseSeries(logs, 'bench');
    expect(series).toHaveLength(1);
    // Brzycki 100 kg × 5: 100 × 36 / (37 − 5) = 112.5 kg; the 200 kg time set is ignored
    expect(series[0]).toMatchObject({ topKg: 100, volumeKg: 500, bestKg: 100, bestReps: 5 });
    expect(series[0].e1rm).toBeCloseTo(112.5, 6);
    expect(exerciseSeries(logs, 'plank')).toEqual([]);
    expect(bestLifts(logs).map((l) => l.exerciseId)).toEqual(['bench']);
    expect(trainedExercises(logs, (id) => id).map((e) => e.id)).toEqual(['bench']);
  });

  it('the plank still counts as training stimulus in the share (set-based), with no kg volume', () => {
    const { shares } = muscleDistribution(logs, lookup, '7d', NOW);
    // sets: bench 2 (Chest), plank 1 (Core) → Chest 2/3, Core 1/3; kg volume Chest 500, Core 0
    expect(shares.map((s) => [s.muscle, s.volumeKg])).toEqual([['Chest', 500], ['Core', 0]]);
    expect(shares[0].share).toBeCloseTo(2 / 3, 6);
  });
});

describe('MuscleDistribution volume label', () => {
  it('shows the per-muscle volume in the profile unit and only the share for time-only muscles', () => {
    const lookup = lookupOf([
      exercise('bench', [{ muscle: 'Chest', score: 100 }]),
      exercise('plank', [{ muscle: 'Core', score: 100 }], 'core'),
    ]);
    const base = logsAt(NOW, [{ daysAgo: 1, exercises: [{ exerciseId: 'bench', sets: [{ kg: 100, reps: 5 }] }, { exerciseId: 'plank', sets: [{ kg: 0, reps: 1 }] }] }]);
    renderEn(<MuscleDistribution logs={asTimeSet(base, 1, 0, 45)} lookup={lookup} now={NOW} units="lb" />);
    const list = screen.getByTestId('ana-distribution-list');
    // Chest 1 of 2 sets → 50 %; 500 kg = 1102.3 lb (500 / 0.45359237)
    expect(within(list).getByText('50% of load · 1,102.3 lb volume')).toBeInTheDocument();
    expect(within(list).getByText('50% of load')).toBeInTheDocument();
  });
});
