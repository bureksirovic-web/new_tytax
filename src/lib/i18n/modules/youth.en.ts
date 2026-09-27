// Family-profiles plan (2026-09-27): youth mode strings (settings profile
// form, workout set-type picker, the youth preset's safety note on the
// programs screen). New module, wired like g5Auth (see ../packs/youth.ts).
export const youthEn = {
  youth_birth_year_label: 'Birth year',
  youth_birth_year_hint: 'Optional. Under 16 turns on youth mode: lighter automatic loads and extra safety limits.',
  youth_birth_year_error: 'Enter a year between {min} and {max}.',
  youth_mode_badge: 'Youth mode',
  youth_mode_hint: 'Lighter automatic loads, no drop/failure sets, no rest-day skip, no load-spike warnings.',
  youth_set_type_drop: 'Drop set',
  youth_set_type_failure: 'Failure set',
  youth_preset_safety: 'Supervised by an adult. Warm up for 5 minutes first. Stop right away if it hurts. Technique before reps.',
} as const;
