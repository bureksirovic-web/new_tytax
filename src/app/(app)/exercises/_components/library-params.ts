/**
 * Library filter state <-> URL query (pure). Keys: q (text), m (modality),
 * mg (muscle group), st (station id), att (attachment id), favorites=1
 * (Arsenal only; the nav links to /exercises?favorites=1).
 */
import type { MuscleGroup } from '@/contracts/domain';
import type { CatalogQuery } from '@/contracts/exercise-catalog';
import { isLibraryModality, isMuscleGroup, type LibraryModality } from './labels';

export interface LibraryFilter {
  q: string;
  modality?: LibraryModality;
  muscleGroup?: MuscleGroup;
  stationId?: string;
  attachmentId?: string;
  favorites: boolean;
}

export const EMPTY_FILTER: LibraryFilter = {
  q: '',
  modality: undefined,
  muscleGroup: undefined,
  stationId: undefined,
  attachmentId: undefined,
  favorites: false,
};

interface ParamsLike {
  get(name: string): string | null;
}

const ID_RE = /^[a-z0-9_-]{1,64}$/i;
const cleanId = (v: string | null): string | undefined => (v && ID_RE.test(v) ? v : undefined);

export function parseLibraryParams(params: ParamsLike): LibraryFilter {
  const m = params.get('m');
  const mg = params.get('mg');
  return {
    q: (params.get('q') ?? '').slice(0, 100),
    modality: isLibraryModality(m) ? m : undefined,
    muscleGroup: isMuscleGroup(mg) ? mg : undefined,
    stationId: cleanId(params.get('st')),
    attachmentId: cleanId(params.get('att')),
    favorites: params.get('favorites') === '1',
  };
}

/** Station/attachment only apply to TYTAX (and "all"). */
export function tytaxFiltersApply(f: Pick<LibraryFilter, 'modality'>): boolean {
  return f.modality === undefined || f.modality === 'tytax';
}

/** Query string without the leading "?" (empty when nothing is set). Stable key order. */
export function serializeLibraryParams(f: LibraryFilter): string {
  const p = new URLSearchParams();
  if (f.q.trim()) p.set('q', f.q.trim());
  if (f.modality) p.set('m', f.modality);
  if (f.muscleGroup) p.set('mg', f.muscleGroup);
  if (tytaxFiltersApply(f)) {
    if (f.stationId) p.set('st', f.stationId);
    if (f.attachmentId) p.set('att', f.attachmentId);
  }
  if (f.favorites) p.set('favorites', '1');
  return p.toString();
}

export function toCatalogQuery(f: LibraryFilter): CatalogQuery {
  const tytax = tytaxFiltersApply(f);
  return {
    text: f.q.trim() || undefined,
    modality: f.modality ?? 'all',
    muscleGroup: f.muscleGroup,
    stationId: tytax ? f.stationId : undefined,
    attachmentId: tytax ? f.attachmentId : undefined,
  };
}

/** True when any narrowing filter (not the Arsenal tab) is set. */
export function hasActiveFilters(f: LibraryFilter): boolean {
  return Boolean(f.q.trim() || f.modality || f.muscleGroup || f.stationId || f.attachmentId);
}

/**
 * Route param → exercise id. Decodes once; a malformed escape (e.g. a bare
 * "%") is kept verbatim so the page shows its not-found state instead of
 * throwing a URIError.
 */
export function safeDecodeId(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}
