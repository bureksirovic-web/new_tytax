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
import { chunkForId, loadChunk, loadLegacyNames, resetChunkCacheForTests } from './chunks';
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

/** The original app's `cleanName`: drops the "TYTAX T1 |" style prefix. */
function cleanLegacy(name: string): string {
  return name
    .replace(/TYTAX(Â®|®)?\s*(T1|T1-X|T3-X|T1-M)(-\d+)?\s*\|\s*/gi, '')
    .replace(/Instruction\s*\|\s*/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function buildCatalog(
  chunks: readonly CatalogChunkId[],
  parts: ReadonlyArray<readonly Exercise[]>,
  legacyNames: Readonly<Record<string, string>>,
): Catalog {
  const exercises: readonly Exercise[] = Object.freeze(parts.flat());
  const byId = new Map<string, Exercise>();
  const byLegacy = new Map<string, Exercise>();
  const addLegacy = (key: string | undefined, e: Exercise) => {
    if (!key) return;
    for (const k of [key.toLowerCase(), cleanLegacy(key)]) if (k && !byLegacy.has(k)) byLegacy.set(k, e);
  };
  for (const e of exercises) {
    if (!byId.has(e.id)) byId.set(e.id, e);
  }
  // Legacy logs use either the master-list form ("TYTAX T1 | X") or the plain name.
  for (const e of exercises) {
    addLegacy(e.legacyName, e);
    addLegacy(e.name, e);
  }
  // Generated map: every source name, display-name overrides and reviewed aliases.
  for (const [name, id] of Object.entries(legacyNames)) {
    const e = byId.get(id);
    if (e) addLegacy(name, e);
  }
  const hasTytax = chunks.includes('tytax');
  return Object.freeze({
    chunks: Object.freeze([...chunks]),
    exercises,
    getById: (id: string) => byId.get(id),
    getByLegacyName: (name: string) => byLegacy.get(name.toLowerCase()) ?? byLegacy.get(cleanLegacy(name)),
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
  const names = list.includes('tytax') ? loadLegacyNames() : Promise.resolve({});
  const p = Promise.all([Promise.all(list.map((c) => loadChunk(c))), names]).then(([parts, legacy]) => buildCatalog(list, parts, legacy));
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
