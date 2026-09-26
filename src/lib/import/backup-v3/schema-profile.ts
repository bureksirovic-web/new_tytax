/** zod schemas for Profile and the per-profile record tables (src/contracts/domain.ts). */
import { z } from 'zod/v4';
import type {
  ArsenalEntry,
  BodyweightEntry,
  EquipmentInventory,
  ExerciseNote,
  PRRecord,
  Profile,
  ProfileSettings,
} from '@/contracts';
import {
  calendarDay,
  equipmentRequirement,
  experienceLevel,
  gender,
  id,
  language,
  prType,
  themeName,
  timestamp,
  units,
  warmupStrategy,
} from './primitives';

export const profileSettingsSchema = z.object({
  units,
  language,
  restSeconds: z.number().nonnegative(),
  warmupStrategy,
  barWeightKg: z.number().nonnegative(),
  theme: themeName,
  plateSetKg: z.array(z.number().positive()),
  weakPointInjector: z.boolean(),
  voiceCues: z.boolean(),
  /** Wave 2 (G4-30): same rules as the repo (src/lib/db/repo/settings.ts). */
  pinnedExerciseIds: z
    .array(z.string().trim().min(1))
    .max(4)
    .refine((a) => new Set(a).size === a.length, 'duplicate id')
    .optional(),
}) satisfies z.ZodType<ProfileSettings>;

export const profileSchema = z.object({
  id,
  name: z.string(),
  accountId: z.string().optional(),
  avatarColor: z.string().optional(),
  activeProgramId: id.nullable(),
  settings: profileSettingsSchema,
  bodyweightKg: z.number().optional(),
  gender: gender.optional(),
  experienceLevel: experienceLevel.optional(),
  createdAt: timestamp,
  updatedAt: timestamp,
  deletedAt: timestamp.optional(),
}) satisfies z.ZodType<Profile>;

const owned = { id, profileId: id, updatedAt: timestamp, deletedAt: timestamp.optional() };

export const prRecordSchema = z.object({
  ...owned,
  exerciseId: id,
  exerciseName: z.string(),
  prType,
  value: z.number(),
  kg: z.number(),
  reps: z.number().nonnegative(),
  achievedAt: timestamp,
  workoutLogId: id,
  setId: z.string().optional(),
  createdAt: timestamp,
}) satisfies z.ZodType<PRRecord>;

export const bodyweightEntrySchema = z.object({
  ...owned,
  date: calendarDay,
  valueKg: z.number().positive(),
  createdAt: timestamp,
}) satisfies z.ZodType<BodyweightEntry>;

/** Same rules as `MAX_SETUP_FIELD_LENGTH` in src/lib/db/repo/notes.ts. */
const setupText = z.string().trim().min(1).max(40);
export const machineSetupSchema = z
  .object({
    seat: setupText.optional(),
    pin: setupText.optional(),
    backrest: setupText.optional(),
    benchAngle: setupText.optional(),
    cable: setupText.optional(),
    other: setupText.optional(),
  })
  .strict();

export const exerciseNoteSchema = z.object({
  ...owned,
  exerciseId: id,
  content: z.string(),
  setup: machineSetupSchema.optional(),
  createdAt: timestamp,
}) satisfies z.ZodType<ExerciseNote>;

export const arsenalEntrySchema = z.object({
  ...owned,
  exerciseId: id,
  addedAt: timestamp,
}) satisfies z.ZodType<ArsenalEntry>;

export const equipmentInventorySchema = z.object({
  ...owned,
  stationIds: z.array(z.string()),
  attachmentIds: z.array(z.string()),
  kettlebellsKg: z.array(z.number().positive()),
  bodyweightGear: z.array(equipmentRequirement),
  createdAt: timestamp,
}) satisfies z.ZodType<EquipmentInventory>;
