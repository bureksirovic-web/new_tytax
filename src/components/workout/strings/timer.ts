import { makeStringsHook, type StringTable } from './make-strings';

/** Rest timer bar + active-page header strings (G3). Listed in docs/v2/requests/G3-i18n.md. */
export type TimerKey =
  | 'rest_timer_label'
  | 'rest_timer_remaining_label'
  | 'rest_timer_add30'
  | 'rest_timer_add30_label'
  | 'rest_timer_stop'
  | 'rest_timer_stop_label'
  | 'rest_timer_progress_label'
  | 'rest_timer_complete'
  | 'workout_elapsed_label';

export const TIMER_STRINGS: StringTable<TimerKey> = {
  en: {
    rest_timer_label: 'Rest',
    rest_timer_remaining_label: 'Rest remaining {time}',
    rest_timer_add30: '+30 s',
    rest_timer_add30_label: '+30 s: add 30 seconds of rest',
    rest_timer_stop: 'Skip',
    rest_timer_stop_label: 'Skip rest (Space)',
    rest_timer_progress_label: 'Rest progress',
    rest_timer_complete: 'Rest complete',
    workout_elapsed_label: 'Workout time',
  },
  hr: {
    rest_timer_label: 'Odmor',
    rest_timer_remaining_label: 'Preostalo odmora {time}',
    rest_timer_add30: '+30 s',
    rest_timer_add30_label: '+30 s: dodaj 30 sekundi odmora',
    rest_timer_stop: 'Preskoči',
    rest_timer_stop_label: 'Preskoči odmor (razmaknica)',
    rest_timer_progress_label: 'Napredak odmora',
    rest_timer_complete: 'Odmor završen',
    workout_elapsed_label: 'Trajanje treninga',
  },
};

export const useTimerStrings = makeStringsHook(TIMER_STRINGS);

/** BCP-47 voice language for a UI locale. */
export function voiceLang(locale: string): string {
  return locale === 'hr' ? 'hr-HR' : 'en-US';
}
