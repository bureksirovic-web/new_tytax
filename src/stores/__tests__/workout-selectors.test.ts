import { describe, it, expect } from 'vitest';
import type { SessionExercise, SetEntry, WorkoutDraft } from '@/contracts/domain';
import { countsAsWork, exerciseVolumeKg, summarizeDraft } from '../workout-selectors';

let n = 0;
function set(kg: number, reps: number, done: boolean, type: SetEntry['type'] = 'working'): SetEntry {
  n += 1;
  return { id: `s${n}`, type, kg, reps, done };
}

function exercise(uid: string, sets: SetEntry[]): SessionExercise {
  return { uid, exerciseId: 'bench', exerciseName: 'Bench', modality: 'tytax', sets };
}

describe('workout selectors', () => {
  const bench = exercise('a', [
    set(40, 10, true, 'warmup'),
    set(100, 5, true),
    set(100, 4, true, 'failure'),
    set(100, 8, false),
  ]);
  const row = exercise('b', [set(60, 10, true, 'drop'), set(0, 12, true)]);
  const draft: WorkoutDraft = {
    id: 'd1',
    profileId: 'p1',
    sessionName: 'Quick',
    startedAt: '2026-09-26T10:00:00.000Z',
    exercises: [bench, row],
  };

  it('counts only done non-warm-up sets as work', () => {
    expect(countsAsWork(set(1, 1, true))).toBe(true);
    expect(countsAsWork(set(1, 1, true, 'warmup'))).toBe(false);
    expect(countsAsWork(set(1, 1, false))).toBe(false);
    expect(countsAsWork(set(60, 0, true))).toBe(false); // a 0-rep set is never logged work
  });

  it('computes per-exercise volume', () => {
    // 100×5 + 100×4 = 500 + 400 = 900 (warm-up and undone set excluded).
    expect(exerciseVolumeKg(bench)).toBe(900);
    // 60×10 + 0×12 = 600.
    expect(exerciseVolumeKg(row)).toBe(600);
  });

  it('summarizes a draft', () => {
    expect(summarizeDraft(draft)).toEqual({
      exerciseCount: 2,
      // bench: 2 done working (5-rep, 4-rep failure); row: 2 done (drop, bodyweight) → 4.
      doneSets: 4,
      // 4 bench sets + 2 row sets = 6.
      totalSets: 6,
      // 900 + 600 = 1500.
      volumeKg: 1500,
    });
    expect(summarizeDraft({ ...draft, exercises: [] })).toEqual({ exerciseCount: 0, doneSets: 0, totalSets: 0, volumeKg: 0 });
  });
});
