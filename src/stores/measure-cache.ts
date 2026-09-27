/**
 * Device cache of the catalog's time-measured exercise ids (refuter R2,
 * 2026-09-27). The workout card asks `measureOfExercise`, which needs the lazy
 * catalog; when its chunk cannot load (offline after a reload, a stale shell)
 * a hold without a duration or ghost on its sets was painted and logged as a
 * reps set. Every successful load through `loadCatalogRemembering` records
 * the time ids here (union, never shrinks: an id's measure does not change),
 * so later reloads know a hold without the catalog. Storage failures are
 * ignored: the in-memory copy still serves this page.
 */
import type { Catalog } from '@/contracts/exercise-catalog';
import type { ExerciseMeasure } from '@/contracts/domain';
import { loadCatalog } from '@/lib/catalog';

export const TIME_IDS_STORAGE_KEY = 'tytax.catalog.time-ids.v1';

let known: Set<string> | null = null;

function read(): Set<string> {
  if (known) return known;
  known = new Set();
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(TIME_IDS_STORAGE_KEY) ?? '[]');
    if (Array.isArray(parsed)) for (const id of parsed) if (typeof id === 'string') known.add(id);
  } catch {
    // Unreadable or blocked storage: start empty.
  }
  return known;
}

/** Records every 'time' exercise of `catalog`. */
export function rememberMeasures(catalog: Pick<Catalog, 'exercises'>): void {
  const ids = read();
  const before = ids.size;
  for (const ex of catalog.exercises) if (ex.measure === 'time') ids.add(ex.id);
  if (ids.size === before) return;
  try {
    window.localStorage.setItem(TIME_IDS_STORAGE_KEY, JSON.stringify([...ids].sort()));
  } catch {
    // Blocked storage: the memory copy is enough for this page.
  }
}

/** 'time' when a catalog seen on this device tagged the id so; undefined when unknown. */
export function cachedMeasure(exerciseId: string): ExerciseMeasure | undefined {
  return read().has(exerciseId) ? 'time' : undefined;
}

/** `loadCatalog()` that records the time ids of what it loaded. */
export function loadCatalogRemembering(): Promise<Catalog> {
  return loadCatalog().then((catalog) => {
    rememberMeasures(catalog);
    return catalog;
  });
}

/** Tests only: forget the in-memory copy (the next read goes to storage again). */
export function resetMeasureCacheForTests(): void {
  known = null;
}
