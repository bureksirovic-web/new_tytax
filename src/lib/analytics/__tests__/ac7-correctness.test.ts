/**
 * AC7 analytics correctness (PLAN §2, §10.2). Command: npm test -- analytics
 *
 * Every figure comes from done working sets only (warm-ups and undone sets
 * never count) of logs that are not soft-deleted; recovery uses a real 48 h
 * window measured in timestamps. Each expected value is hand-derived beside it.
 */
import { describe, expect, it } from 'vitest';
import type { Exercise, WorkoutLog } from '@/contracts/domain';
import type { ExerciseLookup } from '@/contracts/training';
import { buildWorkoutLog, sequentialIds, type SeedExerciseInput } from '@/contracts/fixtures';
import { training } from '@/lib/training';
import { computeWeeklyVolume, volumeByMuscle } from '../volume';
import { analyzeMuscleGaps } from '../gap-analysis';
import { computeVolumeParity, movementOf } from '../volume-parity';
import { loadCatalog } from '@/lib/catalog';

// Tuesday 2026-09-29 12:00 local time.
const NOW = new Date(2026, 8, 29, 12, 0, 0);

const bench: Exercise = {
  id: 'bench',
  name: 'Bench',
  modality: 'tytax',
  muscleGroup: 'CHEST',
  pattern: 'Horizontal Press',
  isUnilateral: false,
  defaultSets: 3,
  defaultReps: '8',
  impact: [
    { muscle: 'Chest', score: 100 },
    { muscle: 'Triceps', score: 50 },
  ],
};
const lookup: ExerciseLookup = (id) => (id === 'bench' ? bench : undefined);

let n = 0;
/** A finished log ending `hoursAgo` before NOW (duration 0). */
function log(hoursAgo: number, exercises: SeedExerciseInput[], deleted = false): WorkoutLog {
  n += 1;
  return buildWorkoutLog('p1', { daysAgo: hoursAgo / 24, durationSeconds: 0, deleted, exercises }, NOW, sequentialIds(`ac7-${n}`));
}

/** 2 done working sets 100×5, plus one warm-up 40×10 and one undone 100×5 that must never count. */
const benchSession: SeedExerciseInput = {
  exerciseId: 'bench',
  sets: [
    { kg: 40, reps: 10, type: 'warmup' },
    { kg: 100, reps: 5 },
    { kg: 100, reps: 5 },
    { kg: 100, reps: 5, done: false },
  ],
};

describe('AC7: recovery uses a real 48 h window', () => {
  it('a session 47 h ago counts, one 49 h ago does not (across midnight)', () => {
    const inside = training.recoveryStatus([log(47, [benchSession])], lookup, NOW);
    const chest = inside.muscles.find((m) => m.muscle === 'Chest');
    // 2 done working sets × Chest 1.0 = 2 in the window; 0 < 2 < 6 → recovering; 47 h since
    expect(chest).toMatchObject({ load48h: 2, status: 'recovering', hoursSince: 47 });
    const outside = training.recoveryStatus([log(49, [benchSession])], lookup, NOW);
    // 49 h ago is outside [now − 48 h, now] → no load → fresh, but last trained is still known
    expect(outside.muscles.find((m) => m.muscle === 'Chest')).toMatchObject({ load48h: 0, status: 'fresh', hoursSince: 49 });
    expect(outside.overall).toBe('fresh');
  });

  it('a soft-deleted session never counts', () => {
    const r = training.recoveryStatus([log(10, [benchSession], true)], lookup, NOW);
    expect(r.overall).toBe('fresh');
    // no live log → no muscle rows
    expect(r.muscles).toEqual([]);
  });
});

describe('AC7: ACWR counts done working sets of live logs only', () => {
  it('warm-ups, undone sets and soft-deleted logs are excluded', () => {
    const logs = [log(24, [benchSession]), log(24 * 10, [benchSession]), log(12, [{ exerciseId: 'bench', sets: [{ kg: 100, reps: 5 }] }], true)];
    const chest = training.acwr(logs, lookup, NOW).find((r) => r.muscle === 'Chest');
    // acute (7 d) = 2 sets × 1.0 = 2 (the deleted log's set is excluded); history = floor(10/7)+1 = 2 weeks;
    // chronic = (2 + 2) / 2 = 2; ratio 2/2 = 1 → recovering; previous week (7–14 d) = 2 → stable
    expect(chest).toEqual({ muscle: 'Chest', acuteLoad: 2, chronicLoad: 2, ratio: 1, status: 'recovering', trend: 'stable' });
  });
});

describe('AC7: volume counts done working sets of live logs only', () => {
  it('weekly and per-muscle volume', () => {
    const logs = [log(24, [benchSession]), log(30, [benchSession], true)];
    const weeks = computeWeeklyVolume(logs, { lookup });
    // one live log: 2 × 100 × 5 = 1000 kg (warm-up 400 and undone 500 excluded; deleted log excluded)
    expect(weeks.map((w) => [w.totalVolume, w.sessionCount])).toEqual([[1000, 1]]);
    // Chest 1000 × 1.0 = 1000, Triceps 1000 × 0.5 = 500 (catalog impact; the log has no snapshot)
    expect(weeks[0].byMuscle).toEqual({ Chest: 1000, Triceps: 500 });
    expect(volumeByMuscle(logs, { lookup })).toEqual({ Chest: 1000, Triceps: 500 });
  });

  it('program-started logs without a muscle snapshot still count for muscles (catalog lookup)', () => {
    const logs = [log(24, [benchSession])];
    expect(logs[0].exercises[0].muscleImpactSnapshot).toBeUndefined();
    const gaps = analyzeMuscleGaps(logs, 30, { now: NOW, lookup });
    // shares: Chest 1000 / 1500 = 66.7 %, Triceps 500 / 1500 = 33.3 %
    expect(gaps.map((g) => [g.muscle, Math.round(g.percentageOfTotal * 10) / 10])).toEqual([
      ['Chest', 66.7],
      ['Triceps', 33.3],
    ]);
  });
});

describe('AC7: impact distribution counts done working sets of live logs only', () => {
  it('shares sum to 1 and exclude deleted logs', () => {
    const logs = [log(24, [benchSession]), log(24, [{ exerciseId: 'bench', sets: [{ kg: 100, reps: 5 }] }], true)];
    const d = training.impactDistribution(logs, lookup);
    // per set: Chest 1.0 + Triceps 0.5 = 1.5; 2 sets → Chest 2 / 3 = 0.6667, Triceps 1 / 3 = 0.3333
    expect(Object.keys(d).sort()).toEqual(['Chest', 'Triceps']);
    expect(d.Chest).toBeCloseTo(2 / 3, 6);
    expect(d.Triceps).toBeCloseTo(1 / 3, 6);
    expect(training.laggingMuscle(d)?.muscle).not.toBe('Chest');
  });
});

describe('volume parity uses the catalog\'s real pattern names', () => {
  it('maps presses, rows and squats to their movement', () => {
    expect(movementOf('Horizontal Press')).toBe('push');
    expect(movementOf('Vertical Press')).toBe('push');
    expect(movementOf('Pushdown')).toBe('push');
    expect(movementOf('Horizontal Pull')).toBe('pull');
    expect(movementOf('Hip Extension')).toBe('hinge');
    expect(movementOf('Knee Extension')).toBe('quad');
    expect(movementOf('Calf Raise')).toBe('quad');
    expect(movementOf('Pullover / Shoulder Extension')).toBe('pull');
    expect(movementOf(undefined)).toBe('other');
  });

  it('uses the exercise name inside coarse catalog patterns', async () => {
    const cat = await loadCatalog();
    const byName = (name: string) => cat.exercises.find((e) => e.name === name);
    // [catalog name, its coarse pattern, expected movement]
    const cases: Array<[string, string, string]> = [
      ['Standing Smith Shrug', 'Shoulders', 'pull'],
      ['Lying Sled Assisted Pull Up', 'Shoulders', 'pull'],
      ['Lying Leg Curl', 'Quads', 'hinge'],
      ['Smith Deadlift', 'Quads', 'hinge'],
      ['Standing Cable Curl (Stirrups)', 'Chest', 'pull'],
      ['Lower Pulley Single-Arm Triceps Kickback', 'Kickback', 'push'],
    ];
    for (const [name, pattern, movement] of cases) {
      const e = byName(name);
      expect(e?.pattern).toBe(pattern);
      expect(movementOf(e?.pattern, e?.name)).toBe(movement);
    }
  });

  it('classifies fewer than 10 % of catalog exercises as other', async () => {
    const cat = await loadCatalog();
    const other = cat.exercises.filter((e) => movementOf(e.pattern, e.name) === 'other');
    expect(other.length / cat.exercises.length).toBeLessThan(0.1);
    const parity = computeVolumeParity([log(24, [benchSession])], 30, { now: NOW, lookup });
    // all 1000 kg of bench volume is push → 100 %
    expect(parity.find((p) => p.pattern === 'push')?.percentage).toBe(100);
  });
});
