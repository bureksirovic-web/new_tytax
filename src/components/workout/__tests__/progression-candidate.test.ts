import { describe, expect, it, vi } from 'vitest';
import type { Exercise, Program, ProgramExercise, WorkoutDraft, WorkoutLog } from '@/contracts/domain';
import type { Catalog } from '@/contracts/exercise-catalog';
import type { Repository } from '@/contracts/repo';

const HOLD_ID = 'bw_upper_dip-support-hold';
const HOLD_CHILD = 'bw_dip_parallel-bar-dip';

function exercise(over: Partial<Exercise> & { id: string }): Exercise {
  return {
    name: over.id,
    modality: 'bodyweight',
    muscleGroup: 'TRICEPS',
    pattern: 'test',
    isUnilateral: false,
    defaultSets: 3,
    defaultReps: '10-30s',
    measure: 'time',
    impact: [],
    ...over,
  };
}

let catalogData: Record<string, Exercise> = {
  [HOLD_ID]: exercise({ id: HOLD_ID, name: 'Dip Support Hold', progressionChildIds: [HOLD_CHILD], defaultReps: '10-30s', measure: 'time' }),
  [HOLD_CHILD]: exercise({ id: HOLD_CHILD, defaultReps: '6-12', measure: 'reps', name: 'Parallel Bar Dip' }),
};

function resetCatalog() {
  catalogData = {
    [HOLD_ID]: exercise({ id: HOLD_ID, name: 'Dip Support Hold', progressionChildIds: [HOLD_CHILD], defaultReps: '10-30s', measure: 'time' }),
    [HOLD_CHILD]: exercise({ id: HOLD_CHILD, defaultReps: '6-12', measure: 'reps', name: 'Parallel Bar Dip' }),
  };
}

vi.mock('@/lib/catalog', () => ({
  loadCatalog: async (): Promise<Catalog> => ({
    chunks: ['bodyweight'],
    exercises: [],
    getById: (id: string) => catalogData[id],
    getByLegacyName: () => undefined,
    stations: [],
    attachments: [],
  }),
}));

const { computeProgressionCandidate, applyProgressionSwap, profileBirthYear } = await import('../progression-candidate');

function qualifyingLog(hoursAgo: number): WorkoutLog {
  const finished = new Date(Date.now() - hoursAgo * 3_600_000).toISOString();
  return {
    id: `log-${hoursAgo}`,
    profileId: 'p1',
    sessionName: 'S',
    date: '2026-09-01',
    startedAt: finished,
    finishedAt: finished,
    durationSeconds: 60,
    exercises: [
      {
        uid: 'u1',
        exerciseId: HOLD_ID,
        exerciseName: 'Dip Support Hold',
        modality: 'bodyweight',
        sets: [{ id: 's1', type: 'working', kg: 0, reps: 0, durationSeconds: 30, done: true }],
      },
    ],
    totalVolumeKg: 0,
    totalSets: 1,
    prCount: 0,
    modalitiesUsed: ['bodyweight'],
    createdAt: finished,
    updatedAt: finished,
  };
}

function draftWith(over: Partial<WorkoutDraft> = {}): WorkoutDraft {
  return {
    id: 'draft-1',
    profileId: 'p1',
    programId: 'prog-1',
    programSessionId: 'sess-1',
    sessionName: 'Live',
    startedAt: new Date().toISOString(),
    exercises: [
      {
        uid: 'ux',
        exerciseId: HOLD_ID,
        exerciseName: 'Dip Support Hold',
        modality: 'bodyweight',
        sets: [{ id: 'sx', type: 'working', kg: 0, reps: 0, durationSeconds: 30, done: true }],
      },
    ],
    ...over,
  };
}

/** The originating program: session sess-1 has the hold slot, 1 set of "10-30s". */
function sourceProgram(slot: Partial<ProgramExercise> = {}): Program {
  return {
    id: 'prog-1', profileId: 'p1', name: 'Youth Start', splitType: 'custom', frequency: 3, periodizationType: 'none',
    sessionOrder: ['A'], isPreset: false, currentSessionIndex: 0, createdAt: '', updatedAt: '', modalitiesUsed: ['bodyweight'],
    sessions: [{ id: 'sess-1', programId: 'prog-1', name: 'A', dayIndex: 0,
      exercises: [{ exerciseId: HOLD_ID, exerciseName: 'Dip Support Hold', modality: 'bodyweight', sets: 1, reps: '10-30s', ...slot }] }],
  } as Program;
}

function fakeRepo(over: Partial<Repository> = {}, program: Program | null = sourceProgram()): Repository {
  return {
    logs: { historyFor: async () => [qualifyingLog(72)] },
    programs: {
      get: async () => program ?? undefined,
      update: async () => {
        throw new Error('not implemented');
      },
    },
    ...over,
  } as unknown as Repository;
}

describe('computeProgressionCandidate', () => {
  it('returns null for a quick workout with no program session', async () => {
    const draft = draftWith({ programId: undefined, programSessionId: undefined });
    const candidate = await computeProgressionCandidate(fakeRepo(), 'p1', undefined, draft, new Date());
    expect(candidate).toBeNull();
  });

  it('returns the ready candidate for a qualifying exercise', async () => {
    const draft = draftWith();
    const candidate = await computeProgressionCandidate(fakeRepo(), 'p1', undefined, draft, new Date());
    expect(candidate).toEqual({
      exerciseId: HOLD_ID,
      exerciseName: 'Dip Support Hold',
      nextExerciseId: HOLD_CHILD,
      nextExerciseName: 'Parallel Bar Dip',
      programId: 'prog-1',
      programSessionId: 'sess-1',
      youth: false,
    });
  });

  it('returns null when there is not enough qualifying history', async () => {
    const draft = draftWith();
    const repo = fakeRepo({ logs: { historyFor: async () => [] } } as unknown as Partial<Repository>);
    const candidate = await computeProgressionCandidate(repo, 'p1', undefined, draft, new Date());
    expect(candidate).toBeNull();
  });

  it('uses the originating slot target, not the catalog default (30 s holds do not reach a "20-40s" slot)', async () => {
    const candidate = await computeProgressionCandidate(fakeRepo({}, sourceProgram({ reps: '20-40s' })), 'p1', undefined, draftWith(), new Date());
    expect(candidate).toBeNull();
  });

  it('requires the prescribed set count (1 logged set never satisfies a 2-set slot)', async () => {
    const candidate = await computeProgressionCandidate(fakeRepo({}, sourceProgram({ sets: 2 })), 'p1', undefined, draftWith(), new Date());
    expect(candidate).toBeNull();
  });

  it('never offers an exercise that is not a slot of the originating session, or when that session is gone', async () => {
    const otherSlot = sourceProgram({ exerciseId: 'bw_squat_air-squat', exerciseName: 'Air Squat', reps: '12-15' });
    expect(await computeProgressionCandidate(fakeRepo({}, otherSlot), 'p1', undefined, draftWith(), new Date())).toBeNull();
    expect(await computeProgressionCandidate(fakeRepo({}, null), 'p1', undefined, draftWith(), new Date())).toBeNull();
  });

  it('marks the candidate youth when the birth year makes the profile under 16', async () => {
    const draft = draftWith();
    const candidate = await computeProgressionCandidate(fakeRepo(), 'p1', 2016, draft, new Date('2026-09-27'));
    expect(candidate?.youth).toBe(true);
  });
});

describe('profileBirthYear', () => {
  it('reads a numeric birthYear defensively (additive contract field, not yet typed here)', () => {
    const withYear = { id: 'p1' } as unknown as Parameters<typeof profileBirthYear>[0];
    // Simulate the additive field landing without needing the frozen type to declare it yet.
    (withYear as unknown as { birthYear: number }).birthYear = 2016;
    expect(profileBirthYear(withYear)).toBe(2016);
    expect(profileBirthYear(undefined)).toBeUndefined();
  });
});

describe('applyProgressionSwap', () => {
  const candidate = {
    exerciseId: HOLD_ID,
    exerciseName: 'Dip Support Hold',
    nextExerciseId: HOLD_CHILD,
    nextExerciseName: 'Parallel Bar Dip',
    programId: 'prog-1',
    programSessionId: 'sess-1',
    youth: false,
  };

  function program(): Program {
    return {
      id: 'prog-1',
      profileId: 'p1',
      name: 'Youth Start',
      splitType: 'custom',
      frequency: 3,
      periodizationType: 'none',
      sessionOrder: ['A'],
      isPreset: false,
      currentSessionIndex: 0,
      createdAt: '',
      updatedAt: '',
      sessions: [
        {
          id: 'sess-1',
          programId: 'prog-1',
          name: 'A',
          dayIndex: 0,
          exercises: [{ exerciseId: HOLD_ID, exerciseName: 'Dip Support Hold', modality: 'bodyweight', sets: 3, reps: '10-30s' }],
        },
      ],
      modalitiesUsed: ['bodyweight'],
    };
  }

  it('swaps the exercise in the matching session, resetting reps when the measure unit changes', async () => {
    resetCatalog();
    const update = vi.fn(async (_pid: string, _id: string, patch: Partial<Program>) => ({ ...program(), ...patch }) as Program);
    const repo = fakeRepo({ programs: { get: async () => program(), update } } as unknown as Partial<Repository>);
    await applyProgressionSwap(repo, 'p1', candidate);
    expect(update).toHaveBeenCalledTimes(1);
    const [, , patch] = update.mock.calls[0];
    const slot = patch.sessions?.[0].exercises[0];
    expect(slot?.exerciseId).toBe(HOLD_CHILD);
    expect(slot?.exerciseName).toBe('Parallel Bar Dip');
    expect(slot?.sets).toBe(3); // sets kept
    expect(slot?.reps).toBe('6-12'); // hold -> reps: reset to the child's own default
  });

  it('resets the target to the next step default even when the measure unit does not change', async () => {
    catalogData = {
      ...catalogData,
      [HOLD_CHILD]: exercise({ id: HOLD_CHILD, defaultReps: '20-40s', measure: 'time', name: 'Longer Hold' }),
    };
    const update = vi.fn(async (_pid: string, _id: string, patch: Partial<Program>) => ({ ...program(), ...patch }) as Program);
    const repo = fakeRepo({ programs: { get: async () => program(), update } } as unknown as Partial<Repository>);
    await applyProgressionSwap(repo, 'p1', { ...candidate, nextExerciseName: 'Longer Hold' });
    const [, , patch] = update.mock.calls[0];
    // Plan (critic round 1): a promoted slot always starts at the child's own default target.
    expect(patch.sessions?.[0].exercises[0].reps).toBe('20-40s');
    expect(patch.sessions?.[0].exercises[0].exerciseId).toBe(HOLD_CHILD);
  });

  it('refuses a stale swap: the slot was removed from the originating session after the workout', async () => {
    const edited = program();
    edited.sessions[0].exercises = [{ exerciseId: 'bw_squat_air-squat', exerciseName: 'Air Squat', modality: 'bodyweight', sets: 2, reps: '12-15' }];
    const update = vi.fn();
    const repo = fakeRepo({ programs: { get: async () => edited, update } } as unknown as Partial<Repository>);
    await expect(applyProgressionSwap(repo, 'p1', candidate)).rejects.toThrow(/changed since the workout/);
    expect(update).not.toHaveBeenCalled();
  });

  it('throws when the program is gone', async () => {
    resetCatalog();
    const repo = fakeRepo({ programs: { get: async () => undefined, update: vi.fn() } } as unknown as Partial<Repository>);
    await expect(applyProgressionSwap(repo, 'p1', candidate)).rejects.toThrow();
  });
});
