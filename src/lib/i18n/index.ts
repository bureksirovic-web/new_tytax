export type Locale = 'en' | 'hr';

export const LOCALES: Record<Locale, string> = {
  en: 'English',
  hr: 'Hrvatski',
};

// Core translations
const en = {
  // Navigation
  nav_home: 'Home',
  nav_workout: 'Workout',
  nav_exercises: 'Exercises',
  nav_programs: 'Programs',
  nav_analytics: 'Analytics',
  nav_settings: 'Settings',
  // Workout
  workout_start: 'Start Workout',
  workout_finish: 'Finish',
  workout_add_set: 'Log Set',
  workout_next_exercise: 'Next Exercise',
  workout_rest_timer: 'Rest Timer',
  // General
  save: 'Save',
  cancel: 'Cancel',
  delete: 'Delete',
  confirm: 'Confirm',
  loading: 'Loading...',
  error: 'Error',
  // Exercise library
  exercise_library: 'Exercise Library',
  search_exercises: 'Search exercises...',
  all_modalities: 'All',
  // Programs
  programs: 'Programs',
  my_programs: 'My Programs',
  preset_programs: 'Preset Programs',
  activate_program: 'Activate',
  // Settings
  settings: 'Settings',
  language: 'Language',
  units: 'Units',
  theme: 'Theme',
  family_members: 'Family Members',
  // Auth
  sign_in: 'Sign In',
  sign_out: 'Sign Out',
  email: 'Email',
  continue_with_email: 'Continue with Email',
  check_your_email: 'Check your email for a magic link',
} as const;

export type TranslationKey = keyof typeof en;

const hr: Record<TranslationKey, string> = {
  nav_home: 'Početna',
  nav_workout: 'Trening',
  nav_exercises: 'Vježbe',
  nav_programs: 'Programi',
  nav_analytics: 'Analitika',
  nav_settings: 'Postavke',
  workout_start: 'Započni trening',
  workout_finish: 'Završi',
  workout_add_set: 'Dodaj seriju',
  workout_next_exercise: 'Sljedeća vježba',
  workout_rest_timer: 'Odmor',
  save: 'Spremi',
  cancel: 'Odustani',
  delete: 'Obriši',
  confirm: 'Potvrdi',
  loading: 'Učitavanje...',
  error: 'Greška',
  exercise_library: 'Knjižnica vježbi',
  search_exercises: 'Pretraži vježbe...',
  all_modalities: 'Sve',
  programs: 'Programi',
  my_programs: 'Moji programi',
  preset_programs: 'Gotovi programi',
  activate_program: 'Aktiviraj',
  settings: 'Postavke',
  language: 'Jezik',
  units: 'Jedinice',
  theme: 'Tema',
  family_members: 'Članovi obitelji',
  sign_in: 'Prijava',
  sign_out: 'Odjava',
  email: 'E-mail',
  continue_with_email: 'Nastavi s e-mailom',
  check_your_email: 'Provjerite e-mail za magic link',
};

export const translations: Record<Locale, Record<TranslationKey, string>> = { en, hr };

export function t(key: TranslationKey, locale: Locale = 'en'): string {
  return translations[locale][key] ?? key;
}
