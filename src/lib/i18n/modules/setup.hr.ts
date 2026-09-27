// Croatian strings for the /setup route (family-profiles plan, 2026-09-27).
// Same keys as setup.en.ts (parity test); Record enforces it at compile time.
import type { setupEn } from './setup.en';

export const setupHr: Record<keyof typeof setupEn, string> = {
  link_meta_title: 'Postavljanje profila',
  link_checking: 'Provjera poveznice…',
  link_invalid_title: 'Ova poveznica nije valjana',
  link_invalid_back: 'Natrag u aplikaciju',
  link_error_too_long: 'Ova je poveznica predugačka.',
  link_error_missing_payload: 'Ovoj poveznici nedostaju podaci za postavljanje.',
  link_error_bad_base64: 'Ovu poveznicu nije bilo moguće pročitati.',
  link_error_bad_json: 'Ovu poveznicu nije bilo moguće pročitati.',
  link_error_unsafe_key: 'Ovu poveznicu nije bilo moguće pročitati.',
  link_error_invalid_schema: 'Podaci u ovoj poveznici nisu valjani.',
  link_preview_title: 'Postaviti ove profile?',
  link_preview_origin: 'S adrese {origin}. Ništa se ne stvara dok ne pritisnete Stvori.',
  link_preview_age: '{age} god. (približno)',
  link_preview_program: 'Program: {program}',
  link_create: 'Stvori',
  link_creating: 'Stvaranje…',
  link_cancel: 'Odustani',
  link_cancelled_title: 'Odustalo se',
  link_cancelled_body: 'Ništa nije stvoreno.',
  link_action_failed: 'Postavljanje nije uspjelo. Pokušajte ponovno.',
  link_result_title: 'Gotovo',
  link_result_created: '{name}: stvoren, program {program} instaliran',
  link_result_adopted: '{name}: postojeći profil na uređaju preimenovan i postavljen',
  link_result_skipped: '{name}: već postavljen, preskočeno',
  link_result_dashboard: 'Idi na početnu',
  link_status_created: 'Stvoreno',
  link_status_adopted: 'Preuzeto',
  link_status_skipped: 'Preskočeno',
};
