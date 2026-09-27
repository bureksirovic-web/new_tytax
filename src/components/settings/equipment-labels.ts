import type { EquipmentRequirement } from '@/contracts/domain';
import type { TranslationKey } from '@/lib/i18n';
import '@/lib/i18n/packs/requests';
import '@/lib/i18n/packs/settings';

/**
 * Catalog ids are compared in a normalised form (lower case, `_` → `-`), so the
 * tytax_library.json keys (`SMITH`, `TRICEPS_ROPE`, …) and the pre-library ids
 * (`smith`, `rope`, …) share one table.
 */
export function normalizeEquipmentId(id: string): string {
  return id.toLowerCase().replace(/_/g, '-');
}

/** The seven catalog stations use G1's `station_*` keys; `tytax` is a pre-library id. */
const STATION_LABEL: Readonly<Record<string, TranslationKey>> = {
  smith: 'station_SMITH',
  'back-upper': 'station_BACK_UPPER',
  'back-lower': 'station_BACK_LOWER',
  'leg-extension': 'station_LEG_EXTENSION',
  'leg-curl': 'station_LEG_CURL',
  frame: 'station_FRAME',
  'free-weight': 'station_FREE_WEIGHT',
  tytax: 'set_station_tytax',
};

const ATTACHMENT_LABEL: Readonly<Record<string, TranslationKey>> = {
  rope: 'set_att_rope',
  'triceps-rope': 'set_att_rope',
  'v-bar': 'set_att_v_bar',
  'v-handle': 'set_att_v_bar',
  'straight-bar': 'set_att_straight_bar',
  'd-handle': 'set_att_d_handle',
  'd-handles': 'set_att_d_handle',
  'ankle-strap': 'set_att_ankle_strap',
  belt: 'set_att_belt',
  'dip-belt': 'set_att_belt',
  'lat-bar': 'set_att_lat_bar',
  'ez-bar': 'set_att_ez_bar',
  'ez-lat-bar': 'set_att_ez_bar',
  'row-handle': 'set_att_row_handle',
};

/** Localised name key for a catalog station id; undefined → show the catalog name. */
export function stationLabelKey(id: string): TranslationKey | undefined {
  return STATION_LABEL[normalizeEquipmentId(id)];
}

/** Localised name key for a catalog attachment id; undefined → show the catalog name. */
export function attachmentLabelKey(id: string): TranslationKey | undefined {
  return ATTACHMENT_LABEL[normalizeEquipmentId(id)];
}

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
