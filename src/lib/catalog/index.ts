/**
 * Lazy exercise catalog (implements `CatalogApi` from src/contracts/exercise-catalog.ts).
 *
 * Exercise data is split into one dynamically imported chunk per modality
 * (see ./chunks.ts). UI code imports this module, never `@/data/**`.
 */
import type { AttachmentDef, Exercise, Station } from '@/contracts/domain';
import {
  CATALOG_CHUNKS,
  type Catalog,
  type CatalogApi,
  type CatalogChunkId,
  type CatalogQuery,
} from '@/contracts/exercise-catalog';
import { TYTAX_STATIONS } from '@/data/tytax/stations';
import { TYTAX_ATTACHMENTS } from '@/data/tytax/attachments';
import { chunkForId, loadChunk, resetChunkCacheForTests } from './chunks';
import { filterExercises } from './query';

export { normalizeText } from './query';
export type { Catalog, CatalogApi, CatalogChunkId, CatalogQuery } from '@/contracts/exercise-catalog';

/** Stations/attachments generated from `tytax_library.json` by `npm run catalog:build` (small; no exercise data). */
const STATIONS: readonly Station[] = TYTAX_STATIONS;
const ATTACHMENTS: readonly AttachmentDef[] = TYTAX_ATTACHMENTS;
const STATION_NAME_BY_ID: ReadonlyMap<string, string> = new Map(STATIONS.map((s) => [s.id, s.name]));

/** Chunks in canonical order, deduplicated. `undefined` → all. */
function canonicalChunks(chunks?: readonly CatalogChunkId[]): CatalogChunkId[] {
  if (!chunks) return [...CATALOG_CHUNKS];
  const want = new Set(chunks);
  return CATALOG_CHUNKS.filter((c) => want.has(c));
}

function buildCatalog(chunks: readonly CatalogChunkId[], parts: ReadonlyArray<readonly Exercise[]>): Catalog {
  const exercises: readonly Exercise[] = Object.freeze(parts.flat());
  const byId = new Map<string, Exercise>();
  const byLegacy = new Map<string, Exercise>();
  for (const e of exercises) {
    if (!byId.has(e.id)) byId.set(e.id, e);
    // Legacy logs use either the master-list form ("TYTAX T1 | X") or the plain name.
    for (const key of [e.legacyName, e.name]) {
      if (key && !byLegacy.has(key.toLowerCase())) byLegacy.set(key.toLowerCase(), e);
    }
  }
  const hasTytax = chunks.includes('tytax');
  return Object.freeze({
    chunks: Object.freeze([...chunks]),
    exercises,
    getById: (id: string) => byId.get(id),
    getByLegacyName: (name: string) => byLegacy.get(name.toLowerCase()),
    stations: hasTytax ? STATIONS : [],
    attachments: hasTytax ? ATTACHMENTS : [],
  });
}

const catalogPromises = new Map<string, Promise<Catalog>>();

/** Loads (memoised) the given chunks, default all. Same chunks → same `Catalog` object. */
export function loadCatalog(chunks?: readonly CatalogChunkId[]): Promise<Catalog> {
  const list = canonicalChunks(chunks);
  const key = list.join('+');
  const cached = catalogPromises.get(key);
  if (cached) return cached;
  const p = Promise.all(list.map((c) => loadChunk(c))).then((parts) => buildCatalog(list, parts));
  catalogPromises.set(key, p);
  p.catch(() => {
    if (catalogPromises.get(key) === p) catalogPromises.delete(key);
  });
  return p;
}

/** Loads only the chunk the id prefix names; an unknown prefix loads everything. */
export async function getById(id: string): Promise<Exercise | undefined> {
  const chunk = chunkForId(id);
  const cat = await loadCatalog(chunk ? [chunk] : undefined);
  return cat.getById(id);
}

/**
 * Case- and diacritic-insensitive search. Loads only the chunk a concrete
 * `modality` filter needs, otherwise all chunks.
 */
export async function search(query: CatalogQuery): Promise<Exercise[]> {
  const m = query.modality;
  const only: CatalogChunkId | undefined =
    m === 'tytax' || m === 'bodyweight' || m === 'kettlebell' ? m : undefined;
  if (m === 'custom') return [];
  const cat = await loadCatalog(only ? [only] : undefined);
  return filterExercises(cat.exercises, query, STATION_NAME_BY_ID);
}

/** Warm every chunk (the service worker precache relies on this). */
export async function preloadAll(): Promise<void> {
  await loadCatalog();
}

export const catalog: CatalogApi = { loadCatalog, getById, search, preloadAll };

/** Test-only: forget every memoised chunk and catalog. */
export function resetCatalogForTests(): void {
  catalogPromises.clear();
  resetChunkCacheForTests();
}
