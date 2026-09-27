'use client';
import { makeStringsHook, type StringTable } from './make-strings';

/** Start page (/workout): quick start, program card, draft card, start offers. */
export type StartKey =
  | 'quick_session_name'
  | 'rest_day'
  | 'rest_day_hint'
  | 'complete_rest_day'
  | 'continue_workout'
  | 'discard_workout'
  | 'discard_title'
  | 'discard_message'
  | 'discard_confirm'
  | 'discard_keep'
  | 'deload_title'
  | 'deload_body'
  | 'deload_accept'
  | 'deload_decline'
  | 'weak_title'
  | 'weak_body'
  | 'weak_accept'
  | 'weak_decline'
  | 'start_error'
  | 'foreign_title'
  | 'foreign_title_unknown'
  | 'foreign_body'
  | 'foreign_body_gone'
  | 'foreign_switch'
  | 'foreign_switch_unknown'
  | 'foreign_switch_failed';

export const START_STRINGS: StringTable<StartKey> = {
  en: {
    quick_session_name: 'Quick workout',
    rest_day: 'Rest day',
    rest_day_hint: 'Recover today. Complete the rest day to unlock the next session.',
    complete_rest_day: 'Complete rest day',
    continue_workout: 'Continue workout',
    discard_workout: 'Discard workout',
    discard_title: 'Discard workout?',
    discard_message: 'Every set logged in "{name}" will be lost. This cannot be undone.',
    discard_confirm: 'Discard',
    discard_keep: 'Keep training',
    deload_title: 'Deload recommended',
    deload_body: 'Your recovery is low. Deload this session: one set less per exercise and 15% lighter.',
    deload_accept: 'Deload this session',
    deload_decline: 'Train as planned',
    weak_title: 'Weak point detected',
    weak_body: 'Lagging muscle: {muscle}. Add {exercise} for {sets} sets?',
    weak_accept: 'Add exercise',
    weak_decline: 'Not today',
    start_error: 'Could not start the workout. Try again.',
    foreign_title: 'Workout in progress for {name}',
    foreign_title_unknown: 'Workout in progress for another profile',
    foreign_body: '"{session}" was started on another profile. Switch back to continue it, or discard it.',
    foreign_body_gone: '"{session}" was started on a profile that no longer exists. It can only be discarded.',
    foreign_switch: 'Switch to {name}',
    foreign_switch_unknown: 'Switch back',
    foreign_switch_failed: 'Could not switch to that profile. It may have been deleted; you can discard this workout.',
  },
  hr: {
    quick_session_name: 'Brzi trening',
    rest_day: 'Dan odmora',
    rest_day_hint: 'Danas se oporavi. Završi dan odmora za sljedeću sesiju.',
    complete_rest_day: 'Završi dan odmora',
    continue_workout: 'Nastavi trening',
    discard_workout: 'Odbaci trening',
    discard_title: 'Odbaciti trening?',
    discard_message: 'Sve serije zabilježene u "{name}" bit će izgubljene. Ovo se ne može poništiti.',
    discard_confirm: 'Odbaci',
    discard_keep: 'Nastavi trenirati',
    deload_title: 'Preporučeno rasterećenje',
    deload_body: 'Oporavak ti je slab. Rasterećenje ove sesije: jedna serija manje po vježbi i 15 % manja težina.',
    deload_accept: 'Rasterećenje ove sesije',
    deload_decline: 'Treniraj po planu',
    weak_title: 'Otkrivena slaba točka',
    weak_body: 'Mišić koji zaostaje: {muscle}. Dodati {exercise} ({sets} serije)?',
    weak_accept: 'Dodaj vježbu',
    weak_decline: 'Ne danas',
    start_error: 'Trening se nije mogao pokrenuti. Pokušaj ponovno.',
    foreign_title: 'Trening u tijeku za profil {name}',
    foreign_title_unknown: 'Trening u tijeku za drugi profil',
    foreign_body: '"{session}" je započet na drugom profilu. Vrati se na njega za nastavak ili ga odbaci.',
    foreign_body_gone: '"{session}" je započet na profilu koji više ne postoji. Može se samo odbaciti.',
    foreign_switch: 'Prebaci na {name}',
    foreign_switch_unknown: 'Vrati se na profil',
    foreign_switch_failed: 'Prebacivanje na taj profil nije uspjelo. Možda je obrisan; ovaj trening možeš odbaciti.',
  },
};

export const useStartStrings = makeStringsHook(START_STRINGS);
