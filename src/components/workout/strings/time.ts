import { makeStringsHook, type StringTable } from './make-strings';

/** Time-measured set rows (Wave 2, G3). Listed in docs/v2/requests/G3-i18n.md ("Wave 2"). */
export type TimeKey =
  | 'time_duration'
  | 'time_placeholder'
  | 'time_ghost'
  | 'time_hold_start'
  | 'time_hold_stop'
  | 'time_rir'
  | 'time_done_needs_duration';

export const TIME_STRINGS: StringTable<TimeKey> = {
  en: {
    time_duration: 'Duration (seconds or m:ss)',
    time_placeholder: 'sec',
    time_ghost: 'Last time {time}',
    time_hold_start: 'Start hold timer',
    time_hold_stop: 'Stop hold timer at {time} and save it',
    time_rir: 'RIR, reps in reserve (0-5), optional',
    time_done_needs_duration: 'Enter a duration or time the hold first',
  },
  hr: {
    time_duration: 'Trajanje (sekunde ili m:ss)',
    time_placeholder: 'sek',
    time_ghost: 'Prošli put {time}',
    time_hold_start: 'Pokreni mjerenje izdržaja',
    time_hold_stop: 'Zaustavi mjerenje na {time} i spremi',
    time_rir: 'RIR, ponavljanja u rezervi (0-5), neobavezno',
    time_done_needs_duration: 'Prvo unesi trajanje ili izmjeri izdržaj',
  },
};

export const useTimeStrings = makeStringsHook(TIME_STRINGS);
