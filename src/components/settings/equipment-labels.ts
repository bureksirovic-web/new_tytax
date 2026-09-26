import type { EquipmentRequirement } from '@/contracts/domain';
import type { TranslationKey } from '@/lib/i18n';

/** Localised names for catalog station ids; unknown ids fall back to the catalog name. */
export const STATION_LABEL: Readonly<Record<string, TranslationKey>> = {
  smith: 'set_station_smith',
  'back-upper': 'set_station_back_upper',
  'back-lower': 'set_station_back_lower',
  'leg-extension': 'set_station_leg_extension',
  'leg-curl': 'set_station_leg_curl',
  tytax: 'set_station_tytax',
};

/** Localised names for catalog attachment ids; unknown ids fall back to the catalog name. */
export const ATTACHMENT_LABEL: Readonly<Record<string, TranslationKey>> = {
  rope: 'set_att_rope',
  'v-bar': 'set_att_v_bar',
  'straight-bar': 'set_att_straight_bar',
  'd-handle': 'set_att_d_handle',
  'ankle-strap': 'set_att_ankle_strap',
  belt: 'set_att_belt',
  'lat-bar': 'set_att_lat_bar',
  'ez-bar': 'set_att_ez_bar',
  'row-handle': 'set_att_row_handle',
};

export const BODYWEIGHT_GEAR: readonly { id: EquipmentRequirement; key: TranslationKey }[] = [
  { id: 'pull-up-bar', key: 'set_eq_pullup_bar' },
  { id: 'dip-station', key: 'set_eq_dip_station' },
  { id: 'rings', key: 'set_eq_rings' },
  { id: 'parallettes', key: 'set_eq_parallettes' },
];

/** Adds or removes `id` (keeps order, no duplicates). */
export function toggleId<T extends string>(list: readonly T[], id: T, on: boolean): T[] {
  const without = list.filter((x) => x !== id);
  return on ? [...without, id] : without;
}
