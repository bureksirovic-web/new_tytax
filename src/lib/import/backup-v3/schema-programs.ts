/** zod schemas for Program and its nested shapes (src/contracts/domain.ts). */
import { z } from 'zod/v4';
import type { PeriodizationConfig, Program, ProgramExercise, ProgramSession } from '@/contracts';
import { calendarDay, id, modality, nonNegInt, periodizationType, splitType, timestamp } from './primitives';

export const periodizationConfigSchema = z.object({
  type: periodizationType,
  linearIncrement: z.number().optional(),
  linearFrequencyWeeks: z.number().optional(),
  undulatingRanges: z.array(z.string()).optional(),
  blockPhases: z.array(z.object({ name: z.string(), weeks: z.number(), focus: z.string() })).optional(),
}) satisfies z.ZodType<PeriodizationConfig>;

export const programExerciseSchema = z.object({
  exerciseId: id,
  exerciseName: z.string(),
  modality,
  sets: nonNegInt,
  reps: z.string(),
  tempo: z.string().optional(),
  restSeconds: z.number().nonnegative().optional(),
  supersetGroup: z.string().optional(),
}) satisfies z.ZodType<ProgramExercise>;

export const programSessionSchema = z.object({
  id,
  programId: z.string(),
  name: z.string(),
  dayIndex: nonNegInt,
  exercises: z.array(programExerciseSchema),
  isRest: z.boolean().optional(),
}) satisfies z.ZodType<ProgramSession>;

export const programSchema = z.object({
  id,
  profileId: id,
  name: z.string(),
  splitType,
  frequency: nonNegInt,
  periodizationType,
  periodizationConfig: periodizationConfigSchema.optional(),
  sessionOrder: z.array(z.string()),
  sessions: z.array(programSessionSchema),
  modalitiesUsed: z.array(modality),
  isPreset: z.boolean(),
  presetId: z.string().optional(),
  currentSessionIndex: nonNegInt,
  rotationStartDate: calendarDay.optional(),
  createdAt: timestamp,
  updatedAt: timestamp,
  deletedAt: timestamp.optional(),
}) satisfies z.ZodType<Program>;
