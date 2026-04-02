import { create } from 'zustand';
import type { LoggedSet, WorkoutLog, ExerciseLog } from '@/types/workout';
import { db } from '@/lib/db/dexie';
import { enqueue } from '@/lib/sync/queue';
import { generateId, isoDate } from '@/lib/utils';

interface WorkoutStore {
  status: 'idle' | 'active' | 'complete';
  currentExercise: ExerciseLog | null;
  sets: Record<string, LoggedSet[]>;
  startTime: number | null;
  finishedData: WorkoutLog | null;

  exercises: ExerciseLog[];
  currentExerciseIndex: number;
  sessionName: string;
  programId?: string;

  startWorkout: (config: { modality?: string; programSessionId?: string }) => Promise<void>;
  updateSet: (exerciseId: string, setIndex: number, data: Partial<LoggedSet>) => void;
  addSet: (exerciseId: string) => void;
  removeSet: (exerciseId: string, setIndex: number) => void;
  setCurrentExerciseIndex: (index: number) => void;
  finishWorkout: (log?: WorkoutLog) => Promise<void>;
  resetWorkout: () => void;
}

export const useWorkoutStore = create<WorkoutStore>((set, get) => ({
  status: 'idle',
  currentExercise: null,
  sets: {},
  startTime: null,
  finishedData: null,

  exercises: [],
  currentExerciseIndex: 0,
  sessionName: '',

  startWorkout: async (config) => {
    let exercises: ExerciseLog[] = [];
    let sessionName = 'Quick Workout';
    let programId: string | undefined = undefined;
    const sets: Record<string, LoggedSet[]> = {};

    if (config.programSessionId) {
      const programs = (await db.programs.toArray()).filter((p) => !p.deletedAt);
      for (const prog of programs) {
        const session = prog.sessions.find((s) => s.id === config.programSessionId);
        if (session) {
          programId = prog.id;
          sessionName = session.name;
          exercises = session.exercises.map((e) => {
            const exerciseSets = Array.from({ length: e.sets }, (_, i) => ({
              id: crypto.randomUUID(),
              setNumber: i + 1,
              type: 'working' as const,
              kg: 0,
              reps: 0,
              done: false,
              timestamp: new Date().toISOString(),
            }));
            sets[e.exerciseId] = exerciseSets;
            return {
              exerciseRef: e.exerciseId,
              exerciseName: e.exerciseName,
              modality: e.modality,
              sets: [], // Sets are managed in the `sets` record
              restSeconds: e.restSeconds,
            };
          });
          break;
        }
      }
    } else if (config.modality) {
      sessionName = `${config.modality} Workout`;
    }

    set({
      status: 'active',
      startTime: Date.now(),
      exercises,
      currentExerciseIndex: 0,
      currentExercise: exercises.length > 0 ? exercises[0] : null,
      sets,
      sessionName,
      programId,
      finishedData: null,
    });
  },

  updateSet: (exerciseId, setIndex, data) =>
    set((s) => {
      const existingSets = s.sets[exerciseId];
      if (!existingSets) return {};
      const updatedSets = [...existingSets];
      updatedSets[setIndex] = { ...updatedSets[setIndex], ...data };
      return {
        sets: { ...s.sets, [exerciseId]: updatedSets },
      };
    }),

  addSet: (exerciseId) =>
    set((s) => {
      const existingSets = s.sets[exerciseId] || [];
      const lastSet = existingSets[existingSets.length - 1];
      const newSet: LoggedSet = {
        id: crypto.randomUUID(),
        setNumber: existingSets.length + 1,
        type: 'working',
        kg: lastSet?.kg ?? 0,
        reps: lastSet?.reps ?? 0,
        done: false,
        timestamp: new Date().toISOString(),
      };
      return {
        sets: { ...s.sets, [exerciseId]: [...existingSets, newSet] },
      };
    }),

  removeSet: (exerciseId, setIndex) =>
    set((s) => {
      const existingSets = s.sets[exerciseId];
      if (!existingSets) return {};
      const updatedSets = [...existingSets];
      updatedSets.splice(setIndex, 1);
      updatedSets.forEach((set, i) => {
        set.setNumber = i + 1;
      });
      return {
        sets: { ...s.sets, [exerciseId]: updatedSets },
      };
    }),

  setCurrentExerciseIndex: (index) =>
    set((s) => ({
      currentExerciseIndex: index,
      currentExercise: s.exercises[index] || null,
    })),

  finishWorkout: async (log) => {
    const now = new Date();
    const startedAt = get().startTime ? new Date(get().startTime!).toISOString() : now.toISOString();
    const finishedAt = now.toISOString();
    const durationSeconds = Math.round((now.getTime() - new Date(startedAt).getTime()) / 1000);

    const fullExercises = get().exercises.map((ex) => ({
      ...ex,
      sets: get().sets[ex.exerciseRef] || [],
    }));

    const totalVolumeKg = fullExercises.reduce(
      (total, ex) =>
        total + ex.sets.reduce((s, set) => s + (set.done ? set.kg * set.reps : 0), 0),
      0
    );
    const totalSets = fullExercises.reduce(
      (total, ex) => total + ex.sets.filter((s) => s.done).length,
      0
    );
    const prCount = fullExercises.reduce(
      (n, ex) => n + ex.sets.filter((s) => s.isPersonalRecord).length,
      0
    );
    const modalitiesUsed = [...new Set(fullExercises.map((e) => e.modality))];

    const workoutLog: WorkoutLog = {
      id: log?.id ?? generateId(),
      profileId: log?.profileId ?? 'local',
      familyMemberId: log?.familyMemberId,
      programId: log?.programId ?? get().programId,
      sessionName: log?.sessionName ?? get().sessionName ?? 'Quick Workout',
      date: log?.date ?? isoDate(),
      startedAt: log?.startedAt ?? startedAt,
      finishedAt: log?.finishedAt ?? finishedAt,
      durationSeconds: log?.durationSeconds ?? durationSeconds,
      exercises: log?.exercises ?? fullExercises,
      notes: log?.notes,
      rpe: log?.rpe,
      bodyweightKg: log?.bodyweightKg,
      totalVolumeKg: log?.totalVolumeKg ?? totalVolumeKg,
      totalSets: log?.totalSets ?? totalSets,
      prCount: log?.prCount ?? prCount,
      modalitiesUsed: log?.modalitiesUsed ?? modalitiesUsed,
      createdAt: log?.createdAt ?? now.toISOString(),
      updatedAt: now.toISOString(),
      syncedAt: undefined,
    };

    await db.workoutLogs.add(workoutLog);
    await enqueue('workout_logs', 'create', workoutLog.id, workoutLog as unknown as Record<string, unknown>);

    set({
      status: 'complete',
      finishedData: workoutLog,
    });
  },

  resetWorkout: () =>
    set({
      status: 'idle',
      currentExercise: null,
      sets: {},
      startTime: null,
      finishedData: null,
      exercises: [],
      currentExerciseIndex: 0,
      sessionName: '',
      programId: undefined,
    }),
}));
