/**
 * Local adapter for G1's `orderByStation` (Wave 2, G1 item 4 / G3 item 4).
 * Replace the body with G1's export once v2-g1 merges; the signature and
 * semantics match g1/src/lib/workout/order-by-station.ts.
 *
 * `orderByStation(exercises, lookup)` → a new array (input untouched):
 * - a STABLE sort by station rank, so each station is rigged once:
 *   SMITH → BACK_UPPER → BACK_LOWER → LEG_EXTENSION → LEG_CURL → FRAME →
 *   FREE_WEIGHT → any other station (by first appearance) → no station
 *   (bodyweight, stretches, an exercise the lookup does not know);
 * - superset members stay adjacent: every exercise sharing a non-empty
 *   (trimmed) `supersetGroup` moves as one block, in its original inner order,
 *   ranked by its FIRST member's station; '' / null / whitespace is no group;
 * - guard: when that ranking needs more station changes than the input with
 *   each superset gathered at its first member, the gathered order is returned;
 * - the station key is `stationId`, else the display `station`; case,
 *   hyphens and spaces are normalised ("back-upper", "Back Upper Pulley" and
 *   "BACK_UPPER" are the same station) so wave-0 ids and G1's library keys
 *   both work.
 */
import type { Exercise, SessionExercise } from '@/contracts/domain';

export const STATION_ORDER = [
  'SMITH', 'BACK_UPPER', 'BACK_LOWER', 'LEG_EXTENSION', 'LEG_CURL', 'FRAME', 'FREE_WEIGHT',
] as const;

const ALIASES: Readonly<Record<string, string>> = {
  SMITH_MACHINE: 'SMITH',
  BACK_UPPER_PULLEY: 'BACK_UPPER',
  BACK_LOWER_PULLEY: 'BACK_LOWER',
};

type Lookup = (id: string) => Exercise | undefined;

/** Canonical station key, or undefined for no station. */
export function stationKey(station: string | undefined | null): string | undefined {
  if (typeof station !== 'string') return undefined;
  const key = station.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  if (!key) return undefined;
  return ALIASES[key] ?? key;
}

/** Rank of a station among the listed ones; unlisted or missing → `STATION_ORDER.length`. */
export function stationRank(station: string | undefined): number {
  const key = stationKey(station);
  const idx = key === undefined ? -1 : (STATION_ORDER as readonly string[]).indexOf(key);
  return idx === -1 ? STATION_ORDER.length : idx;
}

function stationOf(lookup: Lookup, exerciseId: string): string | undefined {
  const ex = lookup(exerciseId);
  return stationKey(ex?.stationId || ex?.station);
}

function groupKey(se: SessionExercise): string | undefined {
  const g = (se.supersetGroup as string | null | undefined)?.trim();
  return g ? g : undefined;
}

/** Adjacent pairs whose stations differ ("no station" counts as one shared value). */
export function stationChanges(exercises: readonly SessionExercise[], lookup: Lookup): number {
  let changes = 0;
  for (let i = 1; i < exercises.length; i++) {
    if (stationOf(lookup, exercises[i - 1].exerciseId) !== stationOf(lookup, exercises[i].exerciseId)) changes++;
  }
  return changes;
}

export function orderByStation(exercises: readonly SessionExercise[], lookup: Lookup): SessionExercise[] {
  const blocks: SessionExercise[][] = [];
  const byGroup = new Map<string, SessionExercise[]>();
  for (const se of exercises) {
    const g = groupKey(se);
    const existing = g === undefined ? undefined : byGroup.get(g);
    if (existing) {
      existing.push(se);
      continue;
    }
    const members = [se];
    if (g !== undefined) byGroup.set(g, members);
    blocks.push(members);
  }

  const unlisted = new Map<string, number>();
  const rankOf = (station: string | undefined): number => {
    if (station === undefined) return Number.POSITIVE_INFINITY;
    const listed = (STATION_ORDER as readonly string[]).indexOf(station);
    if (listed >= 0) return listed;
    let extra = unlisted.get(station);
    if (extra === undefined) {
      extra = STATION_ORDER.length + unlisted.size;
      unlisted.set(station, extra);
    }
    return extra;
  };

  const keyed = blocks.map((members, index) => ({ members, index, rank: rankOf(stationOf(lookup, members[0].exerciseId)) }));
  const ranked = [...keyed].sort((a, b) => (a.rank === b.rank ? a.index - b.index : a.rank < b.rank ? -1 : 1));
  const ordered = ranked.flatMap((k) => k.members);
  const gathered = blocks.flat();
  return stationChanges(ordered, lookup) > stationChanges(gathered, lookup) ? gathered : ordered;
}
