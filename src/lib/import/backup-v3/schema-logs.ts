/** zod schemas for SetEntry, SessionExercise and WorkoutLog (src/contracts/domain.ts). */
import { z } from 'zod/v4';
import type { MuscleImpact, SessionExercise, SetEntry, WorkoutLog } from '@/contracts';
import { calendarDay, id, modality, nonNegInt, setType, timestamp } from './primitives';

export const muscleImpactSchema = z.object({
  muscle: z.string(),
  /** 0–100 (contract). */
  score: z.number().min(0).max(100),
}) satisfies z.ZodType<MuscleImpact>;

export const setEntrySchema = z.object({
  id,
  type: setType,
  kg: z.number(),
  reps: z.number().nonnegative(),
  /** Reps in reserve, 0–5 (contract). */
  rir: z.number().min(0).max(5).optional(),
  done: z.boolean(),
  completedAt: timestamp.optional(),
  isPR: z.boolean().optional(),
  e1rm: z.number().optional(),
  tempo: z.string().optional(),
  ghostKg: z.number().optional(),
  ghostReps: z.number().optional(),
  /** Time-measured sets only: seconds held (no e1RM, no kg volume). */
  durationSeconds: z.number().nonnegative().optional(),
  ghostDurationSeconds: z.number().nonnegative().optional(),
}) satisfies z.ZodType<SetEntry>;

export const sessionExerciseSchema = z.object({
  uid: id,
  exerciseId: id,
  exerciseName: z.string(),
  modality,
  sets: z.array(setEntrySchema),
  restSeconds: z.number().nonnegative().optional(),
  notes: z.string().optional(),
  supersetGroup: z.string().optional(),
  muscleImpactSnapshot: z.array(muscleImpactSchema).optional(),
}) satisfies z.ZodType<SessionExercise>;

export const workoutLogSchema = z.object({
  id,
  profileId: id,
  programId: id.optional(),
  programSessionId: id.optional(),
  sessionName: z.string(),
  date: calendarDay,
  startedAt: timestamp,
  finishedAt: timestamp,
  durationSeconds: z.number().nonnegative(),
  exercises: z.array(sessionExerciseSchema),
  notes: z.string().optional(),
  /** 1–10 (contract). */
  rpe: z.number().min(1).max(10).optional(),
  bodyweightKg: z.number().optional(),
  totalVolumeKg: z.number().nonnegative(),
  totalSets: nonNegInt,
  prCount: nonNegInt,
  modalitiesUsed: z.array(modality),
  isDeload: z.boolean().optional(),
  createdAt: timestamp,
  updatedAt: timestamp,
  deletedAt: timestamp.optional(),
  syncedAt: timestamp.optional(),
}) satisfies z.ZodType<WorkoutLog>;
