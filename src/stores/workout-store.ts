import { create } from 'zustand';
import type { ExerciseLog, WorkoutState } from '@/types/workout';
import type { ProgramSession } from '@/types/program';

interface WorkoutStore {
  state: WorkoutState;
  sessionName: string;
  programId?: string;
  session?: ProgramSession;
  exercises: ExerciseLog[];
  startedAt?: string;
  bodyweightKg?: number;

  // Actions
  startWorkout: (session: ProgramSession, programId?: string) => void;
  updateSet: (exerciseIndex: number, setIndex: number, data: Partial<ExerciseLog['sets'][0]>) => void;
  addSet: (exerciseIndex: number) => void;
  removeSet: (exerciseIndex: number, setIndex: number) => void;
  swapExercise: (exerciseIndex: number, newExercise: ExerciseLog) => void;
  pauseWorkout: () => void;
  resumeWorkout: () => void;
  finishWorkout: () => void;
  resetWorkout: () => void;
}

export const useWorkoutStore = create<WorkoutStore>((set, get) => {
  // Expose store globally for e2e tests
  if (typeof window !== 'undefined') {
    // @ts-ignore
    window.useWorkoutStore = { getState: get, setState: set };
  }
  return {
  state: 'idle',
  sessionName: '',
  exercises: [],

  startWorkout: (session, programId) => set({
    state: 'active',
    sessionName: session.name,
    programId,
    session,
    exercises: session.exercises.map((e) => ({
      exerciseRef: e.exerciseId,
      exerciseName: e.exerciseName,
      modality: e.modality,
      sets: Array.from({ length: e.sets }, (_, i) => ({
        id: crypto.randomUUID(),
        setNumber: i + 1,
        type: 'working' as const,
        kg: 0,
        reps: 0,
        done: false,
        timestamp: new Date().toISOString(),
      })),
      restSeconds: e.restSeconds,
    })),
    startedAt: new Date().toISOString(),
  }),

  updateSet: (exerciseIndex, setIndex, data) => set((s) => {
    const exercises = structuredClone(s.exercises);
    Object.assign(exercises[exerciseIndex].sets[setIndex], data);
    return { exercises };
  }),

  addSet: (exerciseIndex) => set((s) => {
    const exercises = structuredClone(s.exercises);
    const ex = exercises[exerciseIndex];
    ex.sets.push({
      id: crypto.randomUUID(),
      setNumber: ex.sets.length + 1,
      type: 'working',
      kg: ex.sets.at(-1)?.kg ?? 0,
      reps: ex.sets.at(-1)?.reps ?? 0,
      done: false,
      timestamp: new Date().toISOString(),
    });
    return { exercises };
  }),

  removeSet: (exerciseIndex, setIndex) => set((s) => {
    const exercises = structuredClone(s.exercises);
    exercises[exerciseIndex].sets.splice(setIndex, 1);
    exercises[exerciseIndex].sets.forEach((set, i) => { set.setNumber = i + 1; });
    return { exercises };
  }),

  swapExercise: (exerciseIndex, newExercise) => set((s) => {
    const exercises = structuredClone(s.exercises);
    exercises[exerciseIndex] = newExercise;
    return { exercises };
  }),

  pauseWorkout: () => set({ state: 'paused' }),
  resumeWorkout: () => set({ state: 'active' }),
  finishWorkout: () => set({ state: 'debriefing' }),
  resetWorkout: () => set({ state: 'idle', sessionName: '', exercises: [], startedAt: undefined }),
};
});
