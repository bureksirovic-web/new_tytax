/**
 * Slot-editor equipment helpers (spec §1.2 slot editor): station resolution,
 * owned-equipment filter and station sort. Pure; the caller passes catalog data.
 */
import type { AttachmentDef, EquipmentInventory, EquipmentRequirement, Exercise, Station } from '@/contracts/domain';

/** Station id of an exercise: `stationId`, else the station whose name matches the display `station`. */
export function stationIdOf(ex: Exercise, stations: readonly Station[]): string | undefined {
  if (ex.stationId) return ex.stationId;
  const name = ex.station?.trim().toLowerCase();
  if (!name) return undefined;
  const exact = stations.find((s) => s.name.toLowerCase() === name);
  if (exact) return exact.id;
  return stations.find((s) => s.name.toLowerCase().startsWith(name))?.id;
}

/**
 * Pre-library catalog ids of the attachments that ship with the machine. Used only
 * when the catalog carries no `priority` (the library catalog marks them "Owned").
 */
export const DEFAULT_OWNED_ATTACHMENTS: readonly string[] = ['lat-bar', 'ez-bar'];

/**
 * Attachments owned when the profile has never set up an inventory: the catalog's
 * `priority: "Owned"` entries (tytax_library.json RECOMMENDED_ATTACHMENTS), else the
 * pre-library defaults that exist in the catalog.
 */
export function defaultOwnedAttachments(attachments: readonly AttachmentDef[]): string[] {
  const owned = attachments.filter((a) => a.priority?.toLowerCase() === 'owned').map((a) => a.id);
  if (owned.length > 0 || attachments.some((a) => a.priority !== undefined)) return owned;
  return attachments.filter((a) => DEFAULT_OWNED_ATTACHMENTS.includes(a.id)).map((a) => a.id);
}

export interface Ownership {
  attachmentIds: ReadonlySet<string>;
  /** Null: no station restriction. */
  stationIds: ReadonlySet<string> | null;
  /** Owned bodyweight gear / kettlebell; null (or absent): no gear restriction. */
  gear?: ReadonlySet<EquipmentRequirement> | null;
}

type InventoryLike = Pick<EquipmentInventory, 'attachmentIds' | 'stationIds'> &
  Partial<Pick<EquipmentInventory, 'bodyweightGear' | 'kettlebellsKg'>>;

/** Gear an exercise needs (Settings > Equipment): `requiresEquipment`, plus a kettlebell for KB exercises. */
export function requiredGearOf(ex: Exercise): EquipmentRequirement[] {
  const gear = (ex.requiresEquipment ?? []).filter((g) => g !== 'none' && g !== 'tytax');
  if (ex.modality === 'kettlebell' && !gear.includes('kettlebell')) gear.push('kettlebell');
  return gear;
}

/**
 * An inventory with nothing selected anywhere (stations, attachments, bodyweight gear,
 * kettlebells — as Settings' `isUnconfigured`) counts as "never set up": it owns the
 * catalog's default attachments (`defaultOwnedAttachments(catalog.attachments)`) and all gear.
 */
export function ownershipFrom(inv: InventoryLike | undefined, defaultOwned: readonly string[] = DEFAULT_OWNED_ATTACHMENTS): Ownership {
  const gear = inv?.bodyweightGear ?? [];
  const kbs = inv?.kettlebellsKg ?? [];
  const empty = !inv || inv.attachmentIds.length + inv.stationIds.length + gear.length + kbs.length === 0;
  if (empty) return { attachmentIds: new Set(defaultOwned), stationIds: null, gear: null };
  const owned = new Set<EquipmentRequirement>(gear);
  if (kbs.length > 0) owned.add('kettlebell');
  return {
    attachmentIds: new Set([...inv.attachmentIds]),
    stationIds: inv.stationIds.length > 0 ? new Set(inv.stationIds) : null,
    gear: owned,
  };
}

/**
 * Owned iff every required attachment is owned, (TYTAX) its station is owned when
 * stations are restricted, and all required gear is owned when gear is restricted.
 */
export function ownsExercise(
  requiredAttachments: readonly string[],
  stationId: string | undefined,
  own: Ownership,
  requiredGear: readonly EquipmentRequirement[] = [],
): boolean {
  if (requiredAttachments.some((a) => !own.attachmentIds.has(a))) return false;
  if (own.stationIds && stationId && !own.stationIds.has(stationId)) return false;
  const gear = own.gear;
  if (gear && requiredGear.some((g) => !gear.has(g))) return false;
  return true;
}
/** Stable sort by station id, then original order; exercises without a station last (P16). */
export function sortIdsByStation(ids: readonly string[], lookup: (id: string) => Exercise | undefined, stations: readonly Station[]): string[] {
  const keyed = ids.map((id, i) => {
    const ex = lookup(id);
    return { id, i, key: ex ? stationIdOf(ex, stations) : undefined };
  });
  keyed.sort((a, b) => {
    if (a.key === b.key) return a.i - b.i;
    if (a.key === undefined) return 1;
    if (b.key === undefined) return -1;
    return a.key < b.key ? -1 : 1;
  });
  return keyed.map((k) => k.id);
}
