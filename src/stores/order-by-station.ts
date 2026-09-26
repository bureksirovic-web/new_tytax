/**
 * Local adapter for G1's `orderByStation` (g1/src/lib/workout/order-by-station.ts).
 * The exported signatures are G1's exactly, so integration is an import swap:
 *
 *   orderByStation<T extends { exerciseId: string; supersetGroup?: string }>(
 *     exercises: readonly T[], catalog: Pick<Catalog, 'getById'> | ExerciseLookup): T[]
 *   stationChanges(exercises, catalog): number
 *   STATION_ORDER: readonly string[]
 *
 * Behaviour (identical to G1 for catalog station keys such as 'SMITH'; G1's
 * test cases run against this file in __tests__/order-by-station-g1.test.ts):
 * - a STABLE sort by station rank, so each station is rigged once:
 *   SMITH → BACK_UPPER → BACK_LOWER → LEG_EXTENSION → LEG_CURL → FRAME →
 *   FREE_WEIGHT → any other station (by first appearance) → no station
 *   (bodyweight, stretches, an exercise the lookup does not know);
 * - superset members stay adjacent: every exercise sharing a non-empty
 *   (trimmed) `supersetGroup` moves as one block, in its original inner order,
 *   ranked by its FIRST member's station;
 * - guard: when that ranking needs more station changes than the input with
 *   each superset gathered at its first member, the gathered order is returned.
 *
 * The one local superset of G1: the station key is `stationKey(stationId ??
 * station)`, normalising case, hyphens, spaces and display names ("back-upper",
 * "Back Upper Pulley" and "BACK_UPPER" are one station). This branch's
 * catalog carries display names only (0 of 1420 TYTAX exercises have a
 * `stationId`); on G1's catalog every key is already canonical, so the swap
 * changes no result. `stationKey` / `exerciseStationKey` also back the
 * inventory match (weak point, swap sheet): see request G3-W2-05.
 */
import type { Exercise } from '@/contracts/domain';
import type { Catalog } from '@/contracts/exercise-catalog';
import type { ExerciseLookup } from '@/contracts/training';

/** Station ids in the order a T1 session walks them (catalog `Exercise.stationId`). */
export const STATION_ORDER: readonly string[] = ['SMITH', 'BACK_UPPER', 'BACK_LOWER', 'LEG_EXTENSION', 'LEG_CURL', 'FRAME', 'FREE_WEIGHT'];

/** Anything that can resolve an exercise id: a loaded catalog or a plain lookup function. */
export type StationCatalog = Pick<Catalog, 'getById'> | ExerciseLookup;

interface OrderableExercise {
  exerciseId: string;
  supersetGroup?: string;
}

const ALIASES: Readonly<Record<string, string>> = {
  SMITH_MACHINE: 'SMITH',
  BACK_UPPER_PULLEY: 'BACK_UPPER',
  BACK_LOWER_PULLEY: 'BACK_LOWER',
  FREE_WEIGHTS: 'FREE_WEIGHT',
};

/** Canonical station key ('back-upper' → 'BACK_UPPER'), or undefined for no station. */
export function stationKey(station: string | undefined | null): string | undefined {
  if (typeof station !== 'string') return undefined;
  const key = station.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  if (!key) return undefined;
  return ALIASES[key] ?? key;
}

/** The exercise's canonical station: `stationId`, else the display `station`. */
export function exerciseStationKey(ex: Pick<Exercise, 'stationId' | 'station'> | undefined): string | undefined {
  return stationKey(ex?.stationId || ex?.station);
}

/** Rank of a station among the listed ones; unlisted or missing → `STATION_ORDER.length`. */
export function stationRank(station: string | undefined): number {
  const key = stationKey(station);
  const idx = key === undefined ? -1 : STATION_ORDER.indexOf(key);
  return idx === -1 ? STATION_ORDER.length : idx;
}

function lookupOf(catalog: StationCatalog): ExerciseLookup {
  return typeof catalog === 'function' ? catalog : (id: string) => catalog.getById(id);
}

function stationOf(lookup: ExerciseLookup, exerciseId: string): string | undefined {
  return exerciseStationKey(lookup(exerciseId));
}

function groupKey(e: OrderableExercise): string | undefined {
  const g = (e.supersetGroup as string | null | undefined)?.trim();
  return g ? g : undefined;
}

/** Adjacent pairs whose stations differ ("no station" counts as one shared value). */
export function stationChanges(exercises: readonly OrderableExercise[], catalog: StationCatalog): number {
  const lookup = lookupOf(catalog);
  let changes = 0;
  for (let i = 1; i < exercises.length; i++) {
    if (stationOf(lookup, exercises[i - 1].exerciseId) !== stationOf(lookup, exercises[i].exerciseId)) changes++;
  }
  return changes;
}

export function orderByStation<T extends { exerciseId: string; supersetGroup?: string }>(
  exercises: readonly T[],
  catalog: Pick<Catalog, 'getById'> | ExerciseLookup,
): T[] {
  const lookup = lookupOf(catalog);
  const blocks: T[][] = [];
  const byGroup = new Map<string, T[]>();
  for (const e of exercises) {
    const g = groupKey(e);
    const existing = g === undefined ? undefined : byGroup.get(g);
    if (existing) {
      existing.push(e);
      continue;
    }
    const members = [e];
    if (g !== undefined) byGroup.set(g, members);
    blocks.push(members);
  }

  const unlisted = new Map<string, number>();
  const rankOf = (station: string | undefined): number => {
    if (station === undefined) return Number.POSITIVE_INFINITY;
    const listed = STATION_ORDER.indexOf(station);
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
