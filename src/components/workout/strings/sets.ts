import { makeStringsHook, type StringTable } from './make-strings';

/** Set rows + session exercise card strings (G3). Listed in docs/v2/requests/G3-i18n.md. */
export type SetsKey =
  | 'set_label'
  | 'warmup_label'
  | 'warmup_badge'
  | 'set_weight'
  | 'set_reps'
  | 'set_rir'
  | 'set_mark_done'
  | 'set_mark_undone'
  | 'set_done_needs_input'
  | 'set_beat_ghost'
  | 'set_e1rm'
  | 'set_e1rm_label'
  | 'set_remove'
  | 'set_remove_title'
  | 'set_remove_message'
  | 'set_remove_confirm'
  | 'set_remove_cancel'
  | 'card_add_set'
  | 'card_add_warmup'
  | 'card_move_up'
  | 'card_move_down'
  | 'card_remove'
  | 'card_remove_title'
  | 'card_remove_message'
  | 'card_remove_confirm'
  | 'card_swap'
  | 'card_video'
  | 'card_video_menu'
  | 'card_video_search'
  | 'card_video_option';

export const SETS_STRINGS: StringTable<SetsKey> = {
  en: {
    set_label: 'Set {n}',
    warmup_label: 'Warm-up {n}',
    warmup_badge: 'W',
    set_weight: 'Weight ({unit})',
    set_reps: 'Reps',
    set_rir: 'RIR, reps in reserve (0-5)',
    set_mark_done: 'Mark done',
    set_mark_undone: 'Mark not done',
    set_done_needs_input: 'Enter weight and reps first',
    set_beat_ghost: 'Beat last time: more than {reps} reps',
    set_e1rm: 'e1RM {value}',
    set_e1rm_label: 'Estimated one-rep max',
    set_remove: 'Delete set',
    set_remove_title: 'Delete set?',
    set_remove_message: 'This set has logged data. Delete it?',
    set_remove_confirm: 'Delete',
    set_remove_cancel: 'Cancel',
    card_add_set: 'Add set',
    card_add_warmup: 'Add warm-up',
    card_move_up: 'Move up',
    card_move_down: 'Move down',
    card_remove: 'Remove exercise',
    card_remove_title: 'Remove exercise?',
    card_remove_message: '{name} has done sets. Removing it deletes them from this workout.',
    card_remove_confirm: 'Remove',
    card_swap: 'Swap exercise',
    card_video: 'Watch video',
    card_video_menu: 'Videos',
    card_video_search: 'Search YouTube',
    card_video_option: 'Video {n}',
  },
  hr: {
    set_label: 'Serija {n}',
    warmup_label: 'Zagrijavanje {n}',
    warmup_badge: 'Z',
    set_weight: 'Težina ({unit})',
    set_reps: 'Ponavljanja',
    set_rir: 'RIR, ponavljanja u rezervi (0-5)',
    set_mark_done: 'Označi gotovo',
    set_mark_undone: 'Poništi gotovo',
    set_done_needs_input: 'Prvo unesite težinu i ponavljanja',
    set_beat_ghost: 'Nadmaši prošli put: više od {reps} ponavljanja',
    set_e1rm: 'e1RM {value}',
    set_e1rm_label: 'Procijenjeni maksimum za jedno ponavljanje',
    set_remove: 'Obriši seriju',
    set_remove_title: 'Obrisati seriju?',
    set_remove_message: 'Ova serija ima unesene podatke. Obrisati je?',
    set_remove_confirm: 'Obriši',
    set_remove_cancel: 'Odustani',
    card_add_set: 'Dodaj seriju',
    card_add_warmup: 'Dodaj zagrijavanje',
    card_move_up: 'Pomakni gore',
    card_move_down: 'Pomakni dolje',
    card_remove: 'Ukloni vježbu',
    card_remove_title: 'Ukloniti vježbu?',
    card_remove_message: '{name} ima odrađene serije. Uklanjanjem se brišu iz ovog treninga.',
    card_remove_confirm: 'Ukloni',
    card_swap: 'Zamijeni vježbu',
    card_video: 'Pogledaj video',
    card_video_menu: 'Videozapisi',
    card_video_search: 'Pretraži YouTube',
    card_video_option: 'Video {n}',
  },
};

export const useSetsStrings = makeStringsHook(SETS_STRINGS);
