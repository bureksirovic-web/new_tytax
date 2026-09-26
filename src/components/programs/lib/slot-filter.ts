/**
 * Slot-editor filtering (legacy L4455-4501, spec §1.2 slot editor): the G4-only
 * layer over G1's `@/lib/programs/{session-kind,equipment}` — muscle/station/
 * modality chips, owned-equipment filter (attachments, stations, bodyweight gear,
 * kettlebells), favourites, text search, and the selection sort by station.
 * Pure; the caller passes catalog data.
 */
import type { Exercise, Modality, Station } from '@/contracts/domain';
import { matchesText, queryWords } from '@/lib/catalog/query';
import { ownsExercise, requiredGearOf, stationIdOf, type Ownership } from '@/lib/programs/equipment';
import { sessionContextAllows, type MuscleChip, type SessionKind } from '@/lib/programs/session-kind';

export function matchesChip(ex: Exercise, chip: MuscleChip): boolean {
  if (chip === 'ALL') return true;
  if (chip === 'BACK') return ex.muscleGroup === 'BACK_VERTICAL' || ex.muscleGroup === 'BACK_HORIZONTAL';
  return ex.muscleGroup === chip;
}

export interface SlotFilterState {
  text: string;
  modality: Modality | 'all';
  muscle: MuscleChip;
  stationId: string | null;
  smart: boolean;
  ownedOnly: boolean;
  favouritesOnly: boolean;
}

export const DEFAULT_SLOT_FILTER: Omit<SlotFilterState, 'modality'> = {
  text: '',
  muscle: 'ALL',
  stationId: null,
  smart: true,
  ownedOnly: false,
  favouritesOnly: false,
};

export interface SlotFilterContext {
  kind: SessionKind | null;
  stations: readonly Station[];
  own: Ownership;
  favourites: ReadonlySet<string>;
  requiredAttachments: (ex: Exercise) => readonly string[];
}

export function filterSlotExercises(all: readonly Exercise[], f: SlotFilterState, ctx: SlotFilterContext): Exercise[] {
  const words = queryWords(f.text);
  return all.filter((ex) => {
    if (f.modality !== 'all' && ex.modality !== f.modality) return false;
    if (f.smart && !sessionContextAllows(ctx.kind, ex)) return false;
    if (!matchesChip(ex, f.muscle)) return false;
    if (f.stationId && stationIdOf(ex, ctx.stations) !== f.stationId) return false;
    if (f.favouritesOnly && !ctx.favourites.has(ex.id)) return false;
    if (f.ownedOnly && !ownsExercise(ctx.requiredAttachments(ex), stationIdOf(ex, ctx.stations), ctx.own, requiredGearOf(ex))) return false;
    return matchesText(ex, words);
  });
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
