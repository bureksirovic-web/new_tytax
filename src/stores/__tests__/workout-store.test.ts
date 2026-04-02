import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useWorkoutStore } from '../workout-store';

vi.mock('@/lib/db/dexie', () => {
  const mockDb = {
    programs: {
      toArray: vi.fn().mockResolvedValue([]),
    },
    workoutLogs: {
      add: vi.fn().mockResolvedValue(1),
    },
  };
  return { db: mockDb };
});

vi.mock('@/lib/sync/queue', () => ({
  enqueue: vi.fn().mockResolvedValue(undefined),
}));

describe('workout store', () => {
  beforeEach(() => {
    useWorkoutStore.setState({
      status: 'idle',
      currentExercise: null,
      sets: {},
      startTime: null,
      finishedData: null,
      exercises: [],
      currentExerciseIndex: 0,
      sessionName: '',
      programId: undefined,
    });
  });

  it('has correct initial state', () => {
    const state = useWorkoutStore.getState();
    expect(state.status).toBe('idle');
    expect(state.exercises).toEqual([]);
    expect(state.sets).toEqual({});
    expect(state.startTime).toBeNull();
    expect(state.finishedData).toBeNull();
    expect(state.currentExerciseIndex).toBe(0);
    expect(state.sessionName).toBe('');
  });

  it('startWorkout sets status to active', async () => {
    const { startWorkout } = useWorkoutStore.getState();

    await startWorkout({ modality: 'strength' });

    const state = useWorkoutStore.getState();
    expect(state.status).toBe('active');
    expect(state.sessionName).toBe('strength Workout');
    expect(state.startTime).not.toBeNull();
  });

  it('startWorkout sets exercises when programSessionId is provided', async () => {
    const { db } = await import('@/lib/db/dexie');
    vi.mocked(db.programs.toArray).mockResolvedValue([
      {
        id: 'prog-1',
        profileId: 'local',
        name: 'Test Program',
        isActive: true,
        deletedAt: undefined,
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
        sessions: [
          {
            id: 'session-1',
            name: 'Push Day',
            exercises: [
              {
                exerciseId: 'ex-1',
                exerciseName: 'Bench Press',
                modality: 'strength',
                sets: 3,
                restSeconds: 90,
              },
            ],
          },
        ],
      },
    ]);

    const { startWorkout } = useWorkoutStore.getState();
    await startWorkout({ programSessionId: 'session-1' });

    const state = useWorkoutStore.getState();
    expect(state.status).toBe('active');
    expect(state.exercises.length).toBe(1);
    expect(state.exercises[0].exerciseName).toBe('Bench Press');
    expect(state.sets['ex-1']).toBeDefined();
    expect(state.sets['ex-1'].length).toBe(3);
  });

  it('addSet adds a set to an exercise', () => {
    const { addSet } = useWorkoutStore.getState();
    const exerciseId = 'ex-1';

    useWorkoutStore.setState({
      sets: {
        [exerciseId]: [
          {
            id: 'set-1',
            setNumber: 1,
            type: 'working',
            kg: 100,
            reps: 5,
            done: true,
            timestamp: '2026-01-01T00:00:00.000Z',
          },
        ],
      },
    });

    addSet(exerciseId);

    const state = useWorkoutStore.getState();
    expect(state.sets[exerciseId].length).toBe(2);
    expect(state.sets[exerciseId][1].setNumber).toBe(2);
    expect(state.sets[exerciseId][1].kg).toBe(100);
    expect(state.sets[exerciseId][1].reps).toBe(5);
  });

  it('addSet creates first set when none exist', () => {
    const { addSet } = useWorkoutStore.getState();
    const exerciseId = 'ex-1';

    useWorkoutStore.setState({
      sets: { [exerciseId]: [] },
    });

    addSet(exerciseId);

    const state = useWorkoutStore.getState();
    expect(state.sets[exerciseId].length).toBe(1);
    expect(state.sets[exerciseId][0].setNumber).toBe(1);
    expect(state.sets[exerciseId][0].kg).toBe(0);
    expect(state.sets[exerciseId][0].reps).toBe(0);
  });

  it('finishWorkout sets status to complete and persists data', async () => {
    const { startWorkout, finishWorkout } = useWorkoutStore.getState();

    await startWorkout({ modality: 'strength' });
    await finishWorkout();

    const state = useWorkoutStore.getState();
    expect(state.status).toBe('complete');
    expect(state.finishedData).not.toBeNull();
    expect(state.finishedData?.sessionName).toBe('strength Workout');
  });

  it('finishWorkout calculates totals correctly', async () => {
    const exerciseId = 'ex-1';

    useWorkoutStore.setState({
      status: 'active',
      startTime: Date.now() - 60000,
      exercises: [
        {
          exerciseRef: exerciseId,
          exerciseName: 'Squat',
          modality: 'strength',
          sets: [],
        },
      ],
      sets: {
        [exerciseId]: [
          {
            id: 'set-1',
            setNumber: 1,
            type: 'working',
            kg: 100,
            reps: 5,
            done: true,
            timestamp: new Date().toISOString(),
          },
          {
            id: 'set-2',
            setNumber: 2,
            type: 'working',
            kg: 100,
            reps: 5,
            done: true,
            timestamp: new Date().toISOString(),
          },
        ],
      },
      sessionName: 'Test Workout',
      currentExerciseIndex: 0,
      currentExercise: null,
      finishedData: null,
    });

    const { finishWorkout } = useWorkoutStore.getState();
    await finishWorkout();

    const state = useWorkoutStore.getState();
    expect(state.finishedData?.totalVolumeKg).toBe(1000);
    expect(state.finishedData?.totalSets).toBe(2);
  });

  it('resetWorkout clears all state', async () => {
    const { startWorkout, resetWorkout } = useWorkoutStore.getState();

    await startWorkout({ modality: 'strength' });
    resetWorkout();

    const state = useWorkoutStore.getState();
    expect(state.status).toBe('idle');
    expect(state.exercises).toEqual([]);
    expect(state.sets).toEqual({});
    expect(state.startTime).toBeNull();
    expect(state.finishedData).toBeNull();
    expect(state.currentExerciseIndex).toBe(0);
    expect(state.sessionName).toBe('');
    expect(state.programId).toBeUndefined();
  });

  it('setCurrentExerciseIndex updates current exercise', () => {
    const { setCurrentExerciseIndex } = useWorkoutStore.getState();

    useWorkoutStore.setState({
      exercises: [
        { exerciseRef: 'ex-1', exerciseName: 'Squat', modality: 'strength', sets: [] },
        { exerciseRef: 'ex-2', exerciseName: 'Bench', modality: 'strength', sets: [] },
      ],
    });

    setCurrentExerciseIndex(1);

    const state = useWorkoutStore.getState();
    expect(state.currentExerciseIndex).toBe(1);
    expect(state.currentExercise?.exerciseName).toBe('Bench');
  });
});
