/**
 * Setup-link payload schema (family-profiles plan, 2026-09-27).
 *
 * `{ v: 1, profiles: [{ name, birthYear?, experienceLevel?, presetId, language? }] }`,
 * 1-6 profiles. `.strict()` everywhere: an unknown key anywhere in the payload
 * is rejected rather than silently ignored (defence against a crafted link
 * smuggling extra data).
 */
import { z } from 'zod/v4';
import { getPresetById } from '@/lib/programs/presets';

/** Max profiles per setup link (amendments after 1b). */
export const MAX_SETUP_PROFILES = 6;

/** `^[\p{L}\p{N} '\-]{1,40}$` after NFC normalisation (amendments after 1b). */
const NAME_PATTERN = /^[\p{L}\p{N} '-]{1,40}$/u;

// Normalise first, then validate length and charset on the NFC form (a
// decomposed 40-character name must not be rejected for its code-unit length).
const nameSchema = z
  .string()
  .max(400)
  .transform((s) => s.normalize('NFC'))
  .pipe(z.string().min(1).max(40).refine((s) => NAME_PATTERN.test(s), { message: 'invalid_name' }));

/** Integer 1920..current year (evaluated per parse, not baked in at module load). */
const birthYearSchema = z
  .number()
  .int()
  .refine((y) => y >= 1920 && y <= new Date().getFullYear(), { message: 'birth_year_out_of_range' });

const experienceLevelSchema = z.enum(['beginner', 'intermediate', 'advanced']);
const languageSchema = z.enum(['hr', 'en']);

/** Must resolve through `getPresetById` (a known built-in program template). */
const presetIdSchema = z
  .string()
  .min(1)
  .refine((id) => getPresetById(id) !== undefined, { message: 'unknown_preset' });

export const setupProfileSchema = z
  .object({
    name: nameSchema,
    birthYear: birthYearSchema.optional(),
    experienceLevel: experienceLevelSchema.optional(),
    presetId: presetIdSchema,
    language: languageSchema.optional(),
  })
  .strict();

export const setupPayloadSchema = z
  .object({
    v: z.literal(1),
    profiles: z.array(setupProfileSchema).min(1).max(MAX_SETUP_PROFILES),
  })
  .strict();

export type SetupProfileInput = z.infer<typeof setupProfileSchema>;
export type SetupPayload = z.infer<typeof setupPayloadSchema>;
