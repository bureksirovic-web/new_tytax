/**
 * Catalog text normalisation and query matching (pure, sync).
 */
import type { Exercise } from '@/contracts/domain';
import type { CatalogQuery } from '@/contracts/exercise-catalog';
import { standardizeMuscle } from '@/lib/constants';

/** Lowercase, NFD-decompose and strip combining marks: "Čučanj" → "cucanj". */
export function normalizeText(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** The normalised words of a query; empty when the text is blank. */
export function queryWords(text: string | undefined): string[] {
  if (!text) return [];
  return normalizeText(text).split(/\s+/).filter((w) => w.length > 0);
}

function haystack(e: Exercise): string {
  const parts = [e.name, e.pattern, e.muscleGroup, ...(e.tags ?? []), ...(e.searchTerms ?? [])];
  return normalizeText(parts.join(' '));
}

const haystackCache = new WeakMap<Exercise, string>();

function cachedHaystack(e: Exercise): string {
  let h = haystackCache.get(e);
  if (h === undefined) {
    h = haystack(e);
    haystackCache.set(e, h);
  }
  return h;
}

/** Every word must occur in name, pattern, muscle group, tags or search terms. */
export function matchesText(e: Exercise, words: readonly string[]): boolean {
  if (words.length === 0) return true;
  const h = cachedHaystack(e);
  return words.every((w) => h.includes(w));
}

/** Impact muscle match, case-insensitive, on the raw or the standardised name. */
export function matchesMuscle(e: Exercise, muscle: string): boolean {
  const want = muscle.trim().toLowerCase();
  return e.impact.some(
    (i) => i.muscle.toLowerCase() === want || standardizeMuscle(i.muscle).toLowerCase() === want,
  );
}

/** Attachment match on the catalog build's `attachmentIds` (tytax_library.json attachment ids). */
export function matchesAttachment(e: Exercise, attachmentId: string): boolean {
  return e.attachmentIds?.includes(attachmentId) ?? false;
}

/**
 * Station match. `stationId` wins; entries without one match when their
 * display `station` equals the name of the station with that id.
 */
export function matchesStation(e: Exercise, stationId: string, stationNameById: ReadonlyMap<string, string>): boolean {
  if (e.stationId !== undefined) return e.stationId === stationId;
  const name = stationNameById.get(stationId);
  return name !== undefined && e.station !== undefined && e.station.toLowerCase() === name.toLowerCase();
}

/** Apply a `CatalogQuery` to an exercise list (order preserved). */
export function filterExercises(
  exercises: readonly Exercise[],
  q: CatalogQuery,
  stationNameById: ReadonlyMap<string, string>,
): Exercise[] {
  const words = queryWords(q.text);
  const pattern = q.pattern ? normalizeText(q.pattern) : undefined;
  const limit = q.limit !== undefined && q.limit >= 0 ? q.limit : Infinity;
  const out: Exercise[] = [];
  for (const e of exercises) {
    if (out.length >= limit) break;
    if (q.modality && q.modality !== 'all' && e.modality !== q.modality) continue;
    if (q.muscleGroup && e.muscleGroup !== q.muscleGroup) continue;
    if (pattern !== undefined && normalizeText(e.pattern) !== pattern) continue;
    if (q.muscle && !matchesMuscle(e, q.muscle)) continue;
    if (q.stationId && !matchesStation(e, q.stationId, stationNameById)) continue;
    if (q.attachmentId && !matchesAttachment(e, q.attachmentId)) continue;
    if (!matchesText(e, words)) continue;
    out.push(e);
  }
  return out;
}
