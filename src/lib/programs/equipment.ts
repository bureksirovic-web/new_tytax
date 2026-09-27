/**
 * Equipment ownership for program exercises (slot editor "owned only",
 * request G4-16). Pure. Ported from G4's tested local adapter
 * `src/components/programs/lib/slot-equipment.ts`, same semantics.
 */
import type { AttachmentDef, EquipmentInventory, EquipmentRequirement, Exercise, Station } from '@/contracts/domain';
import { TYTAX_ATTACHMENTS } from '@/data/tytax/attachments';

/** Attachment ids an exercise needs: its catalog `attachmentIds`, deduplicated (a new array). */
export function requiredAttachments(exercise: Pick<Exercise, 'attachmentIds'>): string[] {
  return [...new Set(exercise.attachmentIds ?? [])];
}

/** Gear an exercise needs (Settings > Equipment): `requiresEquipment`, plus a kettlebell for KB exercises. */
export function requiredGearOf(exercise: Pick<Exercise, 'requiresEquipment' | 'modality'>): EquipmentRequirement[] {
  const gear = (exercise.requiresEquipment ?? []).filter((g) => g !== 'none' && g !== 'tytax');
  if (exercise.modality === 'kettlebell' && !gear.includes('kettlebell')) gear.push('kettlebell');
  return gear;
}

/** Station id of an exercise: `stationId`, else the station whose name matches the display `station` (exact, then prefix). */
export function stationIdOf(exercise: Pick<Exercise, 'stationId' | 'station'>, stations: readonly Station[]): string | undefined {
  if (exercise.stationId) return exercise.stationId;
  const name = exercise.station?.trim().toLowerCase();
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

/** The shipped library's default-owned attachments (today LAT_BAR and EZ_LAT_BAR). */
export const LIBRARY_DEFAULT_OWNED_ATTACHMENTS: readonly string[] = Object.freeze(defaultOwnedAttachments(TYTAX_ATTACHMENTS));

export interface Ownership {
  attachmentIds: ReadonlySet<string>;
  /** Null: no station restriction. */
  stationIds: ReadonlySet<string> | null;
  /** Owned bodyweight gear / kettlebell; null (or absent): no gear restriction. */
  gear?: ReadonlySet<EquipmentRequirement> | null;
}

/** The inventory fields ownership reads; gear and kettlebells may be absent. */
export type InventoryLike = Pick<EquipmentInventory, 'attachmentIds' | 'stationIds'> &
  Partial<Pick<EquipmentInventory, 'bodyweightGear' | 'kettlebellsKg'>>;

/**
 * An inventory with nothing selected anywhere (stations, attachments, bodyweight gear,
 * kettlebells — as Settings' `isUnconfigured`), or none at all, counts as "never set up":
 * it owns `defaultOwned` attachments, every station and all gear.
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
  required: readonly string[],
  stationId: string | undefined,
  own: Ownership,
  requiredGear: readonly EquipmentRequirement[] = [],
): boolean {
  if (required.some((a) => !own.attachmentIds.has(a))) return false;
  if (own.stationIds && stationId && !own.stationIds.has(stationId)) return false;
  const gear = own.gear;
  if (gear && requiredGear.some((g) => !gear.has(g))) return false;
  return true;
}

/**
 * True when the inventory owns every attachment the exercise needs (an exercise
 * needing none always passes). An unconfigured inventory owns `defaultOwned`,
 * by default the shipped library's "Owned" attachments.
 */
export function ownsRequiredAttachment(
  exercise: Pick<Exercise, 'attachmentIds'>,
  inventory: InventoryLike | undefined,
  defaultOwned: readonly string[] = LIBRARY_DEFAULT_OWNED_ATTACHMENTS,
): boolean {
  const own = ownershipFrom(inventory, defaultOwned);
  return requiredAttachments(exercise).every((a) => own.attachmentIds.has(a));
}
