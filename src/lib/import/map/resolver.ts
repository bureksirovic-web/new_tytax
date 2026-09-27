/**
 * Legacy exercise name -> catalog exercise. Unresolved names are kept as
 * custom exercises (`legacy:<slug>-<hash8>`), never dropped.
 */
import type { Exercise, Modality, MuscleImpact } from '@/contracts';
import { sha1Hex } from './sha1';
import type { LegacyNameResolver, UnresolvedExercise } from './types';

export const TYTAX_PREFIX = 'TYTAX T1 | ';

function collapse(name: string): string {
  return name.replace(/\s+/g, ' ').trim();
}

/** Case/whitespace-insensitive key. */
export function nameKey(name: string): string {
  return collapse(name).toLowerCase();
}

function stripPrefix(name: string): string | undefined {
  const c = collapse(name);
  return c.toLowerCase().startsWith(TYTAX_PREFIX.toLowerCase()) ? c.slice(TYTAX_PREFIX.length).trim() : undefined;
}

/** Lowercase ASCII slug; diacritics folded; never empty. */
export function slug(name: string): string {
  const s = name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return s === '' ? 'unnamed' : s;
}

/**
 * Id of an unresolved (custom) exercise. The slug is lossy (non-Latin names
 * all fold to "unnamed", "Row 1/2" and "Row 1-2" share one), so a SHA-1 of the
 * case/whitespace-insensitive name key keeps distinct names apart while the
 * same name always gets the same id (idempotent re-import).
 */
export function customExerciseId(name: string): string {
  return `legacy:${slug(name)}-${sha1Hex(nameKey(name)).slice(0, 8)}`;
}

/**
 * Resolution order: exact name; name without the "TYTAX T1 | " prefix;
 * case/whitespace-normalized name; normalized name without the prefix.
 */
export function resolveLegacyName(name: string, resolver: LegacyNameResolver): Exercise | undefined {
  const stripped = stripPrefix(name);
  const candidates = [name, stripped, nameKey(name), stripped === undefined ? undefined : nameKey(stripped)];
  for (const candidate of candidates) {
    if (candidate === undefined || candidate === '') continue;
    const hit = resolver.getByLegacyName(candidate);
    if (hit) return hit;
  }
  return undefined;
}

/**
 * Resolver over a plain exercise array, used until G1's catalog lands.
 * Matches legacyName first, then name; both case/whitespace-insensitive.
 */
export function createFallbackResolver(exercises: readonly Exercise[]): LegacyNameResolver {
  const byKey = new Map<string, Exercise>();
  for (const ex of exercises) {
    const key = nameKey(ex.name);
    if (!byKey.has(key)) byKey.set(key, ex);
  }
  // legacyName wins over a plain name match.
  for (const ex of exercises) {
    if (ex.legacyName !== undefined) byKey.set(nameKey(ex.legacyName), ex);
  }
  return { getByLegacyName: (name: string) => byKey.get(nameKey(name)) };
}

export interface ResolvedRef {
  exerciseId: string;
  exerciseName: string;
  modality: Modality;
  exercise?: Exercise;
  impact?: MuscleImpact[];
}

/** Memoised resolution for one mapping run that also counts unresolved occurrences. */
export class NameTable {
  private readonly cache = new Map<string, Exercise | null>();
  private readonly misses = new Map<string, number>();

  constructor(private readonly resolver: LegacyNameResolver) {}

  ref(legacyName: string): ResolvedRef {
    let hit = this.cache.get(legacyName);
    if (hit === undefined) {
      hit = resolveLegacyName(legacyName, this.resolver) ?? null;
      this.cache.set(legacyName, hit);
    }
    if (hit === null) {
      this.misses.set(legacyName, (this.misses.get(legacyName) ?? 0) + 1);
      return { exerciseId: customExerciseId(legacyName), exerciseName: legacyName, modality: 'custom' };
    }
    return { exerciseId: hit.id, exerciseName: hit.name, modality: hit.modality, exercise: hit, impact: hit.impact };
  }

  unresolved(): UnresolvedExercise[] {
    return [...this.misses.entries()]
      .map(([legacyName, occurrences]) => ({ legacyName, occurrences }))
      .sort((a, b) => (a.legacyName < b.legacyName ? -1 : a.legacyName > b.legacyName ? 1 : 0));
  }
}
