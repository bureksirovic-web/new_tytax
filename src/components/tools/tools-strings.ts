/**
 * Local string table for the tools pages. Plain module (no 'use client') so
 * server page metadata can read it too. Moves into the shared dictionary
 * once G4 merges it (see docs/v2/requests/G3-i18n.md).
 */
const en = {
  tools_title: 'Tools',
  tools_subtitle: 'Calculators for loading and planning',
  plate_title: 'Plate calculator',
  plate_desc: 'Which plates to put on each side',
  plate_target: 'Target weight (kg)',
  plate_bar: 'Bar weight (kg)',
  plate_per_side: 'Per side',
  plate_loaded: 'Loaded total',
  plate_bar_only: 'Bar only, no plates',
  plate_remainder: 'Not exactly loadable. Missing',
  plate_below_bar: 'Target is lighter than the bar',
  plate_invalid: 'Enter a weight greater than 0',
  rm_title: '1RM calculator',
  rm_desc: 'Estimate your one-rep max',
  rm_weight: 'Weight (kg)',
  rm_reps: 'Reps',
  rm_result: 'Estimated 1RM',
  rm_invalid: 'Enter weight and reps greater than 0',
  rm_percent_table: 'Percent of 1RM',
  rm_rep_table: 'Rep maxes',
  rm_col_percent: '%',
  rm_col_weight: 'kg',
  rm_col_reps: 'Reps',
  unit_kg: 'kg',
  plate_too_heavy: 'Maximum target is 1000 kg',
  rm_too_many_reps: 'Enter at most 30 reps',
  tools_meta_desc: 'Plate and 1RM calculators',
  plate_meta_desc: 'Which plates to load on each side of the bar',
  rm_meta_desc: 'Estimate your one-rep max from a set',
  rm_unreliable: 'Estimates from more than 12 reps are unreliable',
} as const;

export type ToolsKey = keyof typeof en;

const hr: Record<ToolsKey, string> = {
  tools_title: 'Alati',
  tools_subtitle: 'Kalkulatori za opterećenje i planiranje',
  plate_title: 'Kalkulator ploča',
  plate_desc: 'Koje ploče staviti na svaku stranu',
  plate_target: 'Ciljna težina (kg)',
  plate_bar: 'Težina šipke (kg)',
  plate_per_side: 'Po strani',
  plate_loaded: 'Ukupno opterećeno',
  plate_bar_only: 'Samo šipka, bez ploča',
  plate_remainder: 'Nije moguće točno složiti. Nedostaje',
  plate_below_bar: 'Cilj je lakši od šipke',
  plate_invalid: 'Unesite težinu veću od 0',
  rm_title: '1RM kalkulator',
  rm_desc: 'Procjena maksimuma za jedno ponavljanje',
  rm_weight: 'Težina (kg)',
  rm_reps: 'Ponavljanja',
  rm_result: 'Procijenjeni 1RM',
  rm_invalid: 'Unesite težinu i ponavljanja veće od 0',
  rm_percent_table: 'Postotak 1RM-a',
  rm_rep_table: 'Maksimumi po ponavljanjima',
  rm_col_percent: '%',
  rm_col_weight: 'kg',
  rm_col_reps: 'Pon.',
  unit_kg: 'kg',
  plate_too_heavy: 'Najveći cilj je 1000 kg',
  rm_too_many_reps: 'Unesite najviše 30 ponavljanja',
  tools_meta_desc: 'Kalkulatori ploča i 1RM-a',
  plate_meta_desc: 'Koje ploče staviti na svaku stranu šipke',
  rm_meta_desc: 'Procjena maksimuma za jedno ponavljanje iz serije',
  rm_unreliable: 'Procjene iz više od 12 ponavljanja nisu pouzdane',
};

export const TOOLS_STRINGS: { hr: Record<ToolsKey, string>; en: Record<ToolsKey, string> } = {
  hr,
  en,
};

