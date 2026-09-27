import { makeStringsHook, type StringTable } from './make-strings';

/**
 * Wave 2 (G3 items 3 + 4): machine setup on the exercise card and the
 * "order by station" button. Listed in docs/v2/requests/G3-i18n.md ("Wave 2").
 */
export type SetupKey =
  | 'setup_label'
  | 'setup_edit'
  | 'setup_sheet_title'
  | 'setup_seat'
  | 'setup_pin'
  | 'setup_backrest'
  | 'setup_benchAngle'
  | 'setup_cable'
  | 'setup_other'
  | 'setup_hint'
  | 'setup_save'
  | 'setup_saving'
  | 'setup_readonly'
  | 'setup_error'
  | 'order_station'
  | 'order_station_done'
  | 'order_station_same'
  | 'order_station_error';

export const SETUP_STRINGS: StringTable<SetupKey> = {
  en: {
    setup_label: 'Machine setup',
    setup_edit: 'Edit machine setup',
    setup_sheet_title: 'Setup: {name}',
    setup_seat: 'Seat',
    setup_pin: 'Pin',
    setup_backrest: 'Backrest',
    setup_benchAngle: 'Bench angle',
    setup_cable: 'Cable',
    setup_other: 'Other',
    setup_hint: 'Leave a field empty to clear it.',
    setup_save: 'Save setup',
    setup_saving: 'Saving…',
    setup_readonly: 'Saving a setup is not available on this device yet, so it is shown read-only.',
    setup_error: 'Could not save the setup. Try again.',
    order_station: 'Order by station',
    order_station_done: 'Exercises reordered to minimise station changes.',
    order_station_same: 'Already in station order.',
    order_station_error: 'Could not reorder the exercises.',
  },
  hr: {
    setup_label: 'Postavke sprave',
    setup_edit: 'Uredi postavke sprave',
    setup_sheet_title: 'Postavke: {name}',
    setup_seat: 'Sjedalo',
    setup_pin: 'Klin',
    setup_backrest: 'Naslon',
    setup_benchAngle: 'Kut klupe',
    setup_cable: 'Sajla',
    setup_other: 'Ostalo',
    setup_hint: 'Ostavi polje prazno da ga obrišeš.',
    setup_save: 'Spremi postavke',
    setup_saving: 'Spremanje…',
    setup_readonly: 'Spremanje postavki još nije dostupno na ovom uređaju, pa su prikazane samo za čitanje.',
    setup_error: 'Spremanje postavki nije uspjelo. Pokušaj ponovno.',
    order_station: 'Poredaj po stanici',
    order_station_done: 'Vježbe su preslagane da bude što manje promjena stanice.',
    order_station_same: 'Već su poredane po stanici.',
    order_station_error: 'Preslagivanje vježbi nije uspjelo.',
  },
};

export const useSetupStrings = makeStringsHook(SETUP_STRINGS);
