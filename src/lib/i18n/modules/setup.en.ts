// i18n keys for the /setup route (family-profiles plan, 2026-09-27). en lives
// here, hr in setup.hr.ts (one locale per file, so a locale can load on its
// own); the Record type in setup.hr.ts enforces hr/en parity for this module.
// Prefix `link_` (not `setup_`): the workout machine-setup sheet already owns
// `setup_${field}` as a dynamic key family (src/components/workout/setup-*),
// and a shared prefix would false-positive the i18n-packs checker.
export const setupEn = {
  link_meta_title: 'Set up profiles',
  link_checking: 'Checking the link…',
  link_invalid_title: 'This link is not valid',
  link_invalid_back: 'Back to the app',
  link_error_too_long: 'This link is too long.',
  link_error_missing_payload: 'This link is missing its setup data.',
  link_error_bad_base64: 'This link could not be read.',
  link_error_bad_json: 'This link could not be read.',
  link_error_unsafe_key: 'This link could not be read.',
  link_error_invalid_schema: 'This link’s data is not valid.',
  link_preview_title: 'Set up these profiles?',
  link_preview_origin: 'From {origin}. Nothing is created until you press Create.',
  link_preview_age: '{age} years old (approximate)',
  link_preview_program: 'Program: {program}',
  link_create: 'Create',
  link_creating: 'Creating…',
  link_cancel: 'Cancel',
  link_cancelled_title: 'Cancelled',
  link_cancelled_body: 'Nothing was created.',
  link_action_failed: 'Setup failed. Please try again.',
  link_result_title: 'Done',
  link_result_created: '{name}: created, {program} installed',
  link_result_adopted: '{name}: this device’s profile was renamed and set up',
  link_result_skipped: '{name}: already set up, skipped',
  link_result_dashboard: 'Go to the dashboard',
  link_status_created: 'Created',
  link_status_adopted: 'Adopted',
  link_status_skipped: 'Skipped',
} as const;
