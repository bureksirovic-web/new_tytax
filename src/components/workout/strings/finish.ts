'use client';
import { makeStringsHook, type StringTable } from './make-strings';

/** Debrief page (/workout/debrief) and the PR celebration after saving. */
export type FinishKey =
  | 'duration'
  | 'duration_value'
  | 'rpe_label'
  | 'rpe_quick'
  | 'rpe_quick_n'
  | 'pr_title'
  | 'pr_intro'
  | 'pr_continue'
  | 'pr_type_e1rm'
  | 'pr_type_weight'
  | 'pr_type_reps'
  | 'pr_type_volume'
  | 'pr_value_weight'
  | 'pr_value_reps'
  | 'pr_previous_weight'
  | 'pr_previous_reps'
  | 'empty_title'
  | 'empty_body';

export const FINISH_STRINGS: StringTable<FinishKey> = {
  en: {
    duration: 'Duration',
    duration_value: '{n} min',
    rpe_label: 'Session RPE (1–10)',
    rpe_quick: 'Quick RPE',
    rpe_quick_n: 'RPE {n}',
    pr_title: 'New personal records',
    pr_intro: 'New records this session: {n}',
    pr_continue: 'Continue',
    pr_type_e1rm: 'Estimated 1RM',
    pr_type_weight: 'Heaviest weight',
    pr_type_reps: 'Most reps',
    pr_type_volume: 'Best set volume',
    pr_value_weight: '{value} {unit}',
    pr_value_reps: '{value} reps',
    pr_previous_weight: 'was {value} {unit}',
    pr_previous_reps: 'was {value} reps',
    empty_title: 'No sets done',
    empty_body: 'Nothing in this workout is marked done, so there is nothing to save. Go back and log a set, or discard it.',
  },
  hr: {
    duration: 'Trajanje',
    duration_value: '{n} min',
    rpe_label: 'RPE sesije (1–10)',
    rpe_quick: 'Brzi RPE',
    rpe_quick_n: 'RPE {n}',
    pr_title: 'Novi osobni rekordi',
    pr_intro: 'Novih rekorda u ovoj sesiji: {n}',
    pr_continue: 'Nastavi',
    pr_type_e1rm: 'Procijenjeni 1RM',
    pr_type_weight: 'Najveća težina',
    pr_type_reps: 'Najviše ponavljanja',
    pr_type_volume: 'Najveći volumen serije',
    pr_value_weight: '{value} {unit}',
    pr_value_reps: '{value} pon.',
    pr_previous_weight: 'prije {value} {unit}',
    pr_previous_reps: 'prije {value} pon.',
    empty_title: 'Nema odrađenih serija',
    empty_body: 'Ništa u ovom treningu nije označeno kao odrađeno, pa se nema što spremiti. Vrati se i zabilježi seriju ili ga odbaci.',
  },
};

export const useFinishStrings = makeStringsHook(FINISH_STRINGS);
