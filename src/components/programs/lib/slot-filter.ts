/**
 * Slot-editor filtering (legacy L4455-4501, spec §1.2 slot editor): smart
 * session-context filter, muscle/station/modality chips, owned-equipment
 * filter, favourites, text search. Pure; the caller passes catalog data.
 */
import type { EquipmentInventory, Exercise, Modality, MuscleGroup, Program, ProgramSession, Station } from '@/contracts/domain';
import { matchesText, queryWords } from '@/lib/catalog/query';

export type SessionKind = 'full' | 'upper' | 'lower' | 'push' | 'pull' | 'legs';

export type MuscleChip = 'ALL' | 'BACK' | MuscleGroup;

export const MUSCLE_CHIPS: readonly MuscleChip[] = [
  'ALL', 'CHEST', 'BACK', 'BACK_VERTICAL', 'BACK_HORIZONTAL', 'SHOULDERS', 'BICEPS', 'TRICEPS',
  'FOREARMS_GRIP', 'QUADS', 'HAMSTRINGS', 'GLUTES', 'CALVES', 'CORE',
];

const NAME_KINDS: ReadonlyArray<[RegExp, SessionKind]> = [
  [/\b(push|potisak)\b/, 'push'],
  [/\b(pull|povla[cč]enje)\b/, 'pull'],
  [/\b(legs|noge)\b/, 'legs'],
  [/\b(upper|gornji)\b/, 'upper'],
  [/\b(lower|donji)\b/, 'lower'],
  [/\b(full|cijelo)\b/, 'full'],
];

const SPLIT_KINDS: Record<'full_body' | 'upper_lower' | 'push_pull_legs', readonly SessionKind[]> = {
  full_body: ['full'],
  upper_lower: ['upper', 'lower'],
  push_pull_legs: ['push', 'pull', 'legs'],
};

/**
 * Kind of a session. Order: a stored `kind` (request G4-15), the name
 * (en/hr keywords; covers presets like "Upper A"), then split + position
 * among training days. Null → no context filtering.
 */
export function sessionKind(program: Pick<Program, 'splitType' | 'sessions'>, session: ProgramSession): SessionKind | null {
  if (session.isRest) return null;
  const stored = (session as ProgramSession & { kind?: SessionKind }).kind;
  if (stored) return stored;
  const name = session.name.toLowerCase();
  for (const [re, kind] of NAME_KINDS) if (re.test(name)) return kind;
  if (program.splitType === 'custom') return null;
  const pattern = SPLIT_KINDS[program.splitType];
  const i = program.sessions.filter((s) => !s.isRest).findIndex((s) => s.id === session.id);
  return i >= 0 ? pattern[i % pattern.length] : null;
}

function kindFlags(kind: SessionKind | null) {
  return {
    upper: kind === 'upper' || kind === 'push',
    lower: kind === 'lower' || kind === 'legs',
    pull: kind === 'pull',
  };
}

/** Chips hidden by the smart filter (legacy L4552-4565). */
export function hiddenChips(kind: SessionKind | null): ReadonlySet<MuscleChip> {
  const f = kindFlags(kind);
  const out = new Set<MuscleChip>();
  if (f.upper && !f.pull) ['QUADS', 'HAMSTRINGS', 'GLUTES', 'CALVES'].forEach((c) => out.add(c as MuscleChip));
  if (f.pull) ['QUADS', 'CALVES', 'CHEST', 'TRICEPS'].forEach((c) => out.add(c as MuscleChip));
  if (f.lower) ['CHEST', 'BACK', 'BACK_VERTICAL', 'BACK_HORIZONTAL', 'SHOULDERS', 'BICEPS', 'TRICEPS', 'FOREARMS_GRIP'].forEach((c) => out.add(c as MuscleChip));
  return out;
}

const CORE = ['abs', 'obliques', 'core', 'serratus'];
const LEGS = ['quad', 'hamstring', 'glute', 'calf', 'calves', 'soleus', 'gastrocnemius'];
const UPPER = ['chest', 'back', 'lat', 'trap', 'rhomboid', 'delt', 'shoulder', 'bicep', 'tricep', 'forearm', 'grip', 'brach', 'rotator'];
const PULL_EXCLUDE = ['quad', 'chest', 'tricep', 'front delt', 'calf', 'calves', 'soleus'];

/** Primary muscles: impact score ≥ 90 (legacy getImpact level rule). */
function primaryHits(ex: Exercise, fragments: readonly string[]): boolean {
  return ex.impact.some((i) => i.score >= 90 && fragments.some((f) => i.muscle.toLowerCase().includes(f)));
}

/**
 * Smart context filter (legacy L4455-4484). Core-primary exercises are always
 * allowed. Upper/push excludes leg-primary, lower/legs excludes upper-primary,
 * pull excludes quad/chest/triceps/front-delt/calf-primary.
 */
export function contextAllows(kind: SessionKind | null, ex: Exercise): boolean {
  const f = kindFlags(kind);
  if (!f.upper && !f.lower && !f.pull) return true;
  if (primaryHits(ex, CORE)) return true;
  if (f.upper && primaryHits(ex, LEGS)) return false;
  if (f.lower && primaryHits(ex, UPPER)) return false;
  if (f.pull && primaryHits(ex, PULL_EXCLUDE)) return false;
  return true;
}

export function matchesChip(ex: Exercise, chip: MuscleChip): boolean {
  if (chip === 'ALL') return true;
  if (chip === 'BACK') return ex.muscleGroup === 'BACK_VERTICAL' || ex.muscleGroup === 'BACK_HORIZONTAL';
  return ex.muscleGroup === chip;
}

/** Station id of an exercise: `stationId`, else the station whose name matches the display `station`. */
export function stationIdOf(ex: Exercise, stations: readonly Station[]): string | undefined {
  if (ex.stationId) return ex.stationId;
  const name = ex.station?.trim().toLowerCase();
  if (!name) return undefined;
  const exact = stations.find((s) => s.name.toLowerCase() === name);
  if (exact) return exact.id;
  return stations.find((s) => s.name.toLowerCase().startsWith(name))?.id;
}

/** Attachments owned when the profile has never set up an inventory (legacy priority "Owned"). */
export const DEFAULT_OWNED_ATTACHMENTS: readonly string[] = ['lat-bar', 'ez-bar'];

export interface Ownership {
  attachmentIds: ReadonlySet<string>;
  /** Null: no station restriction. */
  stationIds: ReadonlySet<string> | null;
}

/** An inventory with no stations and no attachments counts as "never set up". */
export function ownershipFrom(inv: Pick<EquipmentInventory, 'attachmentIds' | 'stationIds'> | undefined): Ownership {
  const empty = !inv || (inv.attachmentIds.length === 0 && inv.stationIds.length === 0);
  if (empty) return { attachmentIds: new Set(DEFAULT_OWNED_ATTACHMENTS), stationIds: null };
  return {
    attachmentIds: new Set([...inv.attachmentIds]),
    stationIds: inv.stationIds.length > 0 ? new Set(inv.stationIds) : null,
  };
}

/** Owned iff every required attachment is owned and (TYTAX) its station is owned when stations are restricted. */
export function ownsExercise(requiredAttachments: readonly string[], stationId: string | undefined, own: Ownership): boolean {
  if (requiredAttachments.some((a) => !own.attachmentIds.has(a))) return false;
  if (own.stationIds && stationId && !own.stationIds.has(stationId)) return false;
  return true;
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
    if (f.smart && !contextAllows(ctx.kind, ex)) return false;
    if (!matchesChip(ex, f.muscle)) return false;
    if (f.stationId && stationIdOf(ex, ctx.stations) !== f.stationId) return false;
    if (f.favouritesOnly && !ctx.favourites.has(ex.id)) return false;
    if (f.ownedOnly && !ownsExercise(ctx.requiredAttachments(ex), stationIdOf(ex, ctx.stations), ctx.own)) return false;
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
