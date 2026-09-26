/**
 * zod v4 schemas for the RAW legacy shapes. Lenient on extra fields
 * (looseObject), strict on the fields the import depends on. Container
 * arrays are typed as unknown[] on purpose: their items are validated one by
 * one so a single bad record is skipped with a warning, not the whole file.
 */
import { z } from 'zod/v4';
import type { ImportWarning, ImportWarningCode } from './types';

/** Legacy numeric input: number, numeric string, '' or null. Coerced later by parseNumeric. */
export const numLike = z.union([z.number(), z.string(), z.null()]).optional();

export const rawSetSchema = z.looseObject({
  kg: numLike,
  reps: numLike,
  rir: numLike,
  done: z.boolean().optional(),
  type: z.string().optional(),
});

export const rawExerciseSchema = z.looseObject({
  name: z.string(),
  sets: z.array(z.unknown()),
});

export const rawLogSchema = z.looseObject({
  id: z.union([z.number(), z.string()]).optional(),
  date: z.string(),
  session: z.string(),
  exercises: z.array(z.unknown()),
  rpe: numLike,
  notes: z.string().nullable().optional(),
  duration: numLike,
  isDeload: z.boolean().optional(),
});

export const rawBodyweightSchema = z.looseObject({
  date: z.string(),
  value: z.union([z.number(), z.string()]),
});

export const rawPlanSchema = z.record(z.string(), z.array(z.unknown()));

export const rawProtocolSchema = z.looseObject({
  id: z.union([z.string(), z.number()]),
  name: z.string(),
  description: z.string().nullable().optional(),
  data: z.looseObject({
    INITIAL_PLAN: rawPlanSchema,
    INITIAL_ORDER: z.array(z.unknown()),
  }),
});

export const unknownArraySchema = z.array(z.unknown());

/** The legacy "Backup" button export. Its restore required logs or sessionOrder, both arrays. */
export const rawAppBackupSchema = z.looseObject({
  logs: z.array(z.unknown()).optional(),
  sessionOrder: z.array(z.unknown()).optional(),
  trainingPlan: z.unknown().optional(),
  masterExercises: z.unknown().optional(),
  startDate: z.unknown().optional(),
  oledMode: z.unknown().optional(),
  userInventory: z.unknown().optional(),
  userProfile: z.unknown().optional(),
  customProtocols: z.unknown().optional(),
  warmupStrategy: z.unknown().optional(),
});

export type RawSet = z.infer<typeof rawSetSchema>;
export type RawLog = z.infer<typeof rawLogSchema>;
export type RawProtocol = z.infer<typeof rawProtocolSchema>;
export type RawAppBackup = z.infer<typeof rawAppBackupSchema>;

function joinPath(base: string, segments: readonly PropertyKey[]): string {
  let out = base;
  for (const seg of segments) {
    if (typeof seg === 'number') out += `[${seg}]`;
    else out += out ? `.${String(seg)}` : String(seg);
  }
  return out;
}

/**
 * Validates one record. On failure pushes a warning (first issue only, with
 * its full path) and returns undefined so the caller skips the record.
 */
export function validateRecord<T>(
  schema: z.ZodType<T>,
  value: unknown,
  path: string,
  warnings: ImportWarning[],
  code: ImportWarningCode = 'INVALID_RECORD',
): T | undefined {
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  const issue = result.error.issues[0];
  warnings.push({
    code,
    path: joinPath(path, issue?.path ?? []),
    message: `Skipped: ${issue?.message ?? 'invalid record'}`,
  });
  return undefined;
}
