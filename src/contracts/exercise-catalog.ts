/**
 * TYTAX v2 — frozen exercise-catalog contract (Wave 0, 2026-09-26).
 *
 * Implemented by G1 in `src/lib/catalog` (`import { catalog } from '@/lib/catalog'`).
 * The catalog data is split into one lazily imported chunk per modality and
 * never appears in first-load JS: import the loader, never `@/data/**`, from
 * UI code.
 */

import type { AttachmentDef, Exercise, Modality, MuscleGroup, Station } from './domain';

export type CatalogChunkId = 'tytax' | 'bodyweight' | 'kettlebell';

export const CATALOG_CHUNKS: readonly CatalogChunkId[] = Object.freeze(['tytax', 'bodyweight', 'kettlebell']);

/** A loaded (sub)set of the catalog. Lookups are synchronous. */
export interface Catalog {
  /** Chunks this object covers. */
  readonly chunks: readonly CatalogChunkId[];
  readonly exercises: readonly Exercise[];
  getById(id: string): Exercise | undefined;
  /** Exact legacy (tytax-autonomous) name → exercise. Case-insensitive. */
  getByLegacyName(name: string): Exercise | undefined;
  readonly stations: readonly Station[];
  readonly attachments: readonly AttachmentDef[];
}

export interface CatalogQuery {
  /** Case- and diacritic-insensitive match on name, pattern, tags, search terms. */
  text?: string;
  modality?: Modality | 'all';
  muscleGroup?: MuscleGroup;
  /** Impact muscle name (standardised). */
  muscle?: string;
  stationId?: string;
  attachmentId?: string;
  pattern?: string;
  /** Default: no limit. */
  limit?: number;
}

export interface CatalogApi {
  /** Loads (memoised) the given chunks, default all. */
  loadCatalog(chunks?: readonly CatalogChunkId[]): Promise<Catalog>;
  /** Loads only the chunk the id belongs to. */
  getById(id: string): Promise<Exercise | undefined>;
  search(query: CatalogQuery): Promise<Exercise[]>;
  /** Warm every chunk (the service worker precache relies on this). */
  preloadAll(): Promise<void>;
}
