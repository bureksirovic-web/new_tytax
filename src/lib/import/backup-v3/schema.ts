/**
 * zod schema for BackupV3 (src/contracts/repo.ts).
 *
 * Strict on required fields and enums; unknown extra keys are stripped
 * (zod `z.object` default), so a backup written by a newer build that added
 * optional fields still restores.
 */
import { z } from 'zod/v4';
import type { BackupV3 } from '@/contracts';
import { timestamp } from './primitives';
import { workoutLogSchema } from './schema-logs';
import {
  arsenalEntrySchema,
  bodyweightEntrySchema,
  equipmentInventorySchema,
  exerciseNoteSchema,
  prRecordSchema,
  profileSchema,
} from './schema-profile';
import { programSchema } from './schema-programs';

export const BACKUP_V3_FORMAT = 'tytax-backup';
export const BACKUP_V3_VERSION = 3;

export const backupV3Schema = z.object({
  format: z.literal(BACKUP_V3_FORMAT),
  version: z.literal(BACKUP_V3_VERSION),
  exportedAt: timestamp,
  profiles: z.array(profileSchema),
  workoutLogs: z.array(workoutLogSchema),
  programs: z.array(programSchema),
  prRecords: z.array(prRecordSchema),
  bodyweightEntries: z.array(bodyweightEntrySchema),
  exerciseNotes: z.array(exerciseNoteSchema),
  arsenal: z.array(arsenalEntrySchema),
  equipment: z.array(equipmentInventorySchema),
}) satisfies z.ZodType<BackupV3>;

/** Record tables (every table except `profiles`), in backup key order. */
export const OWNED_TABLES = [
  'workoutLogs',
  'programs',
  'prRecords',
  'bodyweightEntries',
  'exerciseNotes',
  'arsenal',
  'equipment',
] as const satisfies ReadonlyArray<keyof BackupV3>;
