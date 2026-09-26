/**
 * Order a workout's exercises by TYTAX T1 station so the lifter re-rigs the
 * machine as few times as possible. Pure: never mutates its input.
 */
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

function lookupOf(catalog: StationCatalog): ExerciseLookup {
  return typeof catalog === 'function' ? catalog : (id: string) => catalog.getById(id);
}

/** Catalog station id of an exercise; undefined for bodyweight, kettlebell, stretches and unknown ids. */
function stationOf(lookup: ExerciseLookup, exerciseId: string): string | undefined {
  const id = lookup(exerciseId)?.stationId;
  return id === undefined || id === '' ? undefined : id;
}

function groupKey(e: OrderableExercise): string | undefined {
  const g = e.supersetGroup?.trim();
  return g ? g : undefined;
}

/**
 * Number of adjacent pairs whose stations differ. Exercises without a
 * station count as one shared "no station" value, so two bodyweight
 * exercises in a row are not a change.
 */
export function stationChanges(exercises: readonly OrderableExercise[], catalog: StationCatalog): number {
  const lookup = lookupOf(catalog);
  let changes = 0;
  for (let i = 1; i < exercises.length; i++) {
    if (stationOf(lookup, exercises[i - 1].exerciseId) !== stationOf(lookup, exercises[i].exerciseId)) changes++;
  }
  return changes;
}

/**
 * Stable reordering by station.
 *
 * - Rank: index of the exercise's station in `STATION_ORDER`. A station id
 *   that is not listed ranks after every listed one, by first appearance.
 *   Exercises without a station (bodyweight, kettlebell, stretches, unknown
 *   ids) rank last. Within a rank the original order is kept.
 * - Supersets: every exercise sharing a non-empty `supersetGroup` forms one
 *   block that keeps its internal order and is never split. The block is
 *   ranked by its FIRST member (in document order), not by its cheapest one:
 *   the lifter starts the superset on that station.
 * - Guard: if that ranking would need more station changes than the input
 *   (with each superset gathered at its first member), the input order is
 *   returned instead. Without supersets the ranking is always optimal
 *   (distinct stations − 1 changes), so the guard only ever fires for a
 *   superset that spans stations. Consequence: when every superset is
 *   contiguous in the input, the result never has more changes than the input.
 */
export function orderByStation<T extends { exerciseId: string; supersetGroup?: string }>(
  exercises: readonly T[],
  catalog: Pick<Catalog, 'getById'> | ExerciseLookup,
): T[] {
  const lookup = lookupOf(catalog);

  // Blocks in document order of their first member; a superset gathers all its members.
  const blocks: T[][] = [];
  const blockOfGroup = new Map<string, T[]>();
  for (const e of exercises) {
    const g = groupKey(e);
    if (g === undefined) {
      blocks.push([e]);
      continue;
    }
    const existing = blockOfGroup.get(g);
    if (existing) existing.push(e);
    else {
      const block = [e];
      blockOfGroup.set(g, block);
      blocks.push(block);
    }
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

  const keyed = blocks.map((block, index) => ({ block, index, rank: rankOf(stationOf(lookup, block[0].exerciseId)) }));
  const ranked = [...keyed].sort((a, b) => (a.rank === b.rank ? a.index - b.index : a.rank < b.rank ? -1 : 1));

  const ordered = ranked.flatMap((k) => k.block);
  const gathered = blocks.flat();
  return stationChanges(ordered, lookup) > stationChanges(gathered, lookup) ? gathered : ordered;
}
