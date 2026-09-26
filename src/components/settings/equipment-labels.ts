import type { EquipmentRequirement } from '@/contracts/domain';
import type { TranslationKey } from '@/lib/i18n';

/**
 * Catalog ids are compared in a normalised form (lower case, `_` → `-`), so the
 * tytax_library.json keys (`SMITH`, `TRICEPS_ROPE`, …) and the pre-library ids
 * (`smith`, `rope`, …) share one table.
 */
export function normalizeEquipmentId(id: string): string {
  return id.toLowerCase().replace(/_/g, '-');
}

const STATION_LABEL: Readonly<Record<string, TranslationKey>> = {
  smith: 'set_station_smith',
  'back-upper': 'set_station_back_upper',
  'back-lower': 'set_station_back_lower',
  'leg-extension': 'set_station_leg_extension',
  'leg-curl': 'set_station_leg_curl',
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
