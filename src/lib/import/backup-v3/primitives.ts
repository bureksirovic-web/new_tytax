/**
 * Shared zod primitives for the BackupV3 schema.
 *
 * Enums are built with `enumOf<T>()`, which fails to compile when a member of
 * the contract union `T` is missing from the runtime list (and `z.enum`'s
 * output type keeps extra members out), so the schema cannot drift silently
 * from `src/contracts/domain.ts`.
 */
import { z } from 'zod/v4';
import type {
  EquipmentRequirement,
  ExperienceLevel,
  Gender,
  Language,
  Modality,
  PeriodizationType,
  PRType,
  SetType,
  SplitType,
  ThemeName,
  Units,
  WarmupStrategy,
} from '@/contracts';

type Missing<T, A extends readonly unknown[]> = Exclude<T, A[number]>;

/** `z.enum` over every member of the string union `T` (compile error when one is missing). */
export function enumOf<T extends string>() {
  return <const A extends readonly [T, ...T[]]>(
    values: A & ([Missing<T, A>] extends [never] ? unknown : { missing: Missing<T, A> }),
  ) => z.enum(values);
}

/** Non-empty id string. */
export const id = z.string().min(1);

/**
 * ISO-8601 datetime, normalised to the exact `toISOString()` shape
 * ('YYYY-MM-DDTHH:mm:ss.sssZ'). Offsets and other precisions are accepted on
 * input but rewritten to UTC milliseconds, so stored stamps compare correctly
 * as strings (last-write-wins, sorting).
 */
export const timestamp = z.iso.datetime({ offset: true }).transform((s, ctx) => {
  // zod keeps running transforms after a failed format check, so guard here too.
  const ms = Date.parse(s);
  if (Number.isNaN(ms)) {
    ctx.issues.push({ code: 'custom', input: s, message: 'Invalid ISO datetime' });
    return z.NEVER;
  }
  return new Date(ms).toISOString();
});

/** Local calendar day 'YYYY-MM-DD'. */
export const calendarDay = z.iso.date();

export const nonNegInt = z.number().int().nonnegative();

export const modality = enumOf<Modality>()(['tytax', 'bodyweight', 'kettlebell', 'custom']);
export const setType = enumOf<SetType>()(['warmup', 'working', 'drop', 'failure']);
export const splitType = enumOf<SplitType>()(['full_body', 'upper_lower', 'push_pull_legs', 'custom']);
export const periodizationType = enumOf<PeriodizationType>()(['none', 'linear', 'undulating', 'block']);
export const units = enumOf<Units>()(['kg', 'lb']);
export const language = enumOf<Language>()(['hr', 'en']);
export const warmupStrategy = enumOf<WarmupStrategy>()(['standard', 'heavy', 'pyramid', 'none']);
export const themeName = enumOf<ThemeName>()(['tactical', 'oled']);
export const gender = enumOf<Gender>()(['male', 'female', 'other']);
export const experienceLevel = enumOf<ExperienceLevel>()(['beginner', 'intermediate', 'advanced']);
export const prType = enumOf<PRType>()(['e1rm', 'weight', 'reps', 'volume']);
export const equipmentRequirement = enumOf<EquipmentRequirement>()([
  'none',
  'pull-up-bar',
  'dip-station',
  'rings',
  'parallettes',
  'kettlebell',
  'tytax',
]);
