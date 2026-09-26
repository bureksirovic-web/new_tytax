/**
 * Regression: v2 `finishWorkout` mapped each exercise to `sets[exerciseRef]`,
 * so a repeated exercise stored the same sets array twice.
 */
import { describe, expect, it } from 'vitest';
import type { LegacyWorkoutLogV2 } from '@/contracts';
import { migrateLogV2 } from '../log';
import { CTX, set } from './fixture';

type LegacyExercise = LegacyWorkoutLogV2['exercises'][number];

function logWith(exercises: LegacyExercise[]): LegacyWorkoutLogV2 {
  return {
    id: 'log-dup',
    profileId: 'local',
    sessionName: 'S',
    date: '2026-03-01',
    startedAt: '2026-03-01T09:00:00.000Z',
    finishedAt: '2026-03-01T10:00:00.000Z',
    durationSeconds: 3600,
    exercises,
    totalVolumeKg: 0,
    totalSets: 0,
    prCount: 0,
    modalitiesUsed: ['tytax'],
    createdAt: '2026-03-01T10:00:00.000Z',
    updatedAt: '2026-03-01T10:00:00.000Z',
  };
}

const bench = (sets: LegacyExercise['sets']): LegacyExercise => ({ exerciseRef: 'bench', exerciseName: 'Bench', modality: 'tytax', sets });
const allSetIds = (log: { exercises: { sets: { id: string }[] }[] }) => log.exercises.flatMap((e) => e.sets.map((s) => s.id));

describe('migrateLogV2: repeated exercise sharing one v2 sets array', () => {
  it('keeps the sets once (later slot empty), so ids are unique and totals are not doubled', () => {
    const shared = [set(1, { kg: 50, reps: 5 }), set(2, { kg: 50, reps: 5, isPersonalRecord: true })];
    const out = migrateLogV2(logWith([bench(shared), bench(shared)]), CTX);
    expect(out.exercises.map((e) => [e.uid, e.sets.length])).toEqual([
      ['log-dup:0', 2],
      ['log-dup:1', 0],
    ]);
    expect(allSetIds(out)).toEqual(['s-1', 's-2']);
    expect(out).toMatchObject({ totalVolumeKg: 500, totalSets: 2, prCount: 1 });
  });

  it('re-ids a colliding set id deterministically when the arrays differ', () => {
    const out = migrateLogV2(logWith([bench([set(1, { kg: 50, reps: 5 })]), bench([set(1, { kg: 40, reps: 8 }), set(2, {})])]), CTX);
    expect(allSetIds(out)).toEqual(['s-1', 'log-dup:1:0', 's-2']);
    expect(out.exercises[1].sets[0]).toMatchObject({ kg: 40, reps: 8 });
    expect(out.totalVolumeKg).toBe(50 * 5 + 40 * 8);
  });

  it('a different exercise with the same set ids is not treated as shared', () => {
    const kb: LegacyExercise = { exerciseRef: 'kb-swing', exerciseName: 'KB', modality: 'kettlebell', sets: [set(1, { kg: 24, reps: 10 })] };
    const out = migrateLogV2(logWith([bench([set(1, { kg: 50, reps: 5 })]), kb]), CTX);
    expect(out.exercises[1].sets).toHaveLength(1);
    expect(new Set(allSetIds(out)).size).toBe(2);
  });

  it('sets without ids are never treated as shared; generated ids stay unique', () => {
    const noId = (): LegacyExercise['sets'] => [{ ...set(1, { kg: 10, reps: 10 }), id: '' }];
    const out = migrateLogV2(logWith([bench(noId()), bench(noId())]), CTX);
    expect(allSetIds(out)).toEqual(['log-dup:0:0', 'log-dup:1:0']);
    expect(out.totalSets).toBe(2);
  });

  it('is idempotent on its own output', () => {
    const shared = [set(1, { kg: 50, reps: 5 })];
    const once = migrateLogV2(logWith([bench(shared), bench(shared)]), CTX);
    expect(migrateLogV2(once, CTX)).toBe(once);
  });
});
